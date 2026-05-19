#!/usr/bin/env node
/**
 * Push a program bundle to Hevy: custom exercises + routines.
 *
 * Usage:
 *   npm run hevy:push -- push-pull-homegym
 *   npm run hevy:push -- push-pull-gym-monster-2 --dry-run
 *   npm run hevy:push -- push-pull-gym-monster-2 --allow-create
 *   npm run hevy:push -- push-pull-homegym --no-fetch
 *   npm run hevy:push -- push-pull-homegym --recreate-routines --i-know-recreate
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createExerciseTemplate,
  createRoutine,
  createRoutineFolder,
  fetchAllPaginated,
  getHevyApiKey,
  tryUpdateRoutine,
} from '../libs/hevy/hevy-client.mjs';
import {
  loadAccountMapping,
  loadBundle,
  mergeAccountMapping,
  normTitle,
  resolveProgramDir,
  saveAccountMapping,
} from '../libs/hevy/program-bundle.mjs';
import { fetchFolderRoutinesByTitle, reconcileRoutines } from '../libs/hevy/reconcile-routines.mjs';
import {
  buildTemplateIndexForAccount,
  cacheStaleWarning,
  loadExerciseTemplates,
  registerTemplate,
  resolveCustomExercise,
} from '../libs/hevy/template-index.mjs';
import { assertBundleValid } from '../libs/hevy/validate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_TEMPLATE_IDS = new Set(['00000000-0000-0000-0000-000000000001']);

export function parsePushArgs(argv) {
  const flags = new Set();
  const positional = [];
  let forceCreateSlug = null;
  let iKnowRecreate = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force-create') {
      flags.add(a);
      forceCreateSlug = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : null;
    } else if (a.startsWith('-')) {
      flags.add(a);
      if (a === '--i-know-recreate') iKnowRecreate = true;
    } else {
      positional.push(a);
    }
  }

  return {
    programArg: positional[0],
    dryRun: flags.has('--dry-run'),
    fetch: flags.has('--fetch'),
    noFetch: flags.has('--no-fetch'),
    allowCreate: flags.has('--allow-create'),
    recreateRoutines: flags.has('--recreate-routines'),
    skipReconcile: flags.has('--skip-reconcile'),
    allowDuplicateRoutines: flags.has('--allow-duplicate-routines'),
    forceCreateSlug,
    iKnowRecreate,
  };
}

function hevyExerciseToPayload(ex) {
  return {
    exerciseTemplateId: ex.exercise_template_id,
    restSeconds: ex.rest_seconds ?? 60,
    notes: ex.notes ?? null,
    supersetId: ex.superset_id,
    sets: (ex.sets ?? []).map((s) => {
      const out = { type: s.type ?? 'normal' };
      if (s.reps != null) out.reps = s.reps;
      if (s.duration_seconds != null) out.durationSeconds = s.duration_seconds;
      if (s.weight_kg != null) out.weightKg = s.weight_kg;
      return out;
    }),
  };
}

function buildTitleToTemplateId(index) {
  const m = new Map();
  for (const [k, v] of index.templatesByTitle) {
    m.set(k, v.id);
  }
  return m;
}

function allowCreateSlugs(mapping, customExercises, allowCreateAll) {
  const slugs = new Set();
  if (allowCreateAll) {
    for (const slug of Object.keys(customExercises ?? {})) slugs.add(slug);
  }
  for (const entry of mapping.toCreate ?? []) {
    slugs.add(entry.slug);
  }
  return slugs;
}

async function ensureCustomExercises({
  mapping,
  customExercises,
  index,
  accountBySlug,
  programBySlug,
  dryRun,
  allowCreateSlugs: createSlugs,
  forceCreateSlug,
}) {
  const results = [];
  const seen = new Set();
  const queue = [];

  for (const entry of mapping.toCreate ?? []) {
    queue.push({ slug: entry.slug, repoTitle: entry.title ?? entry.repoTitle });
    seen.add(entry.slug);
  }

  for (const slug of Object.keys(customExercises ?? {})) {
    if (!seen.has(slug)) {
      const spec = customExercises[slug];
      queue.push({ slug, repoTitle: spec?.title ?? slug });
      seen.add(slug);
    }
  }

  for (const { slug, repoTitle } of queue) {
    const spec = customExercises[slug];
    if (!spec) {
      console.warn(`No custom-exercises.json entry for slug ${slug}, skipping`);
      continue;
    }

    const mayCreate =
      createSlugs.has(slug) || (forceCreateSlug && slug === forceCreateSlug);
    const resolved = resolveCustomExercise({
      slug,
      spec,
      programMappingRow: programBySlug.get(slug),
      accountMappingRow: accountBySlug.get(slug),
      index,
      allowCreate: mayCreate,
      forceCreate: forceCreateSlug === slug,
    });

    if (resolved.ok) {
      console.log(`Exercise resolved (${resolved.source}): "${spec.title}" → ${resolved.hevyId}`);
      results.push({
        slug,
        repoTitle,
        hevyId: resolved.hevyId,
        hevyTitle: resolved.hevyTitle,
      });
      continue;
    }

    if (resolved.needsCreate && mayCreate) {
      if (dryRun) {
        const fakeId = `dry-run-${slug}`;
        console.log(`[dry-run] Would create exercise: "${spec.title}"`);
        registerTemplate(index, fakeId, spec.title);
        results.push({ slug, repoTitle, hevyId: fakeId, hevyTitle: spec.title });
        continue;
      }

      const { id } = await createExerciseTemplate(spec);
      console.log(`Created exercise: "${spec.title}" → ${id}`);
      registerTemplate(index, id, spec.title);
      results.push({ slug, repoTitle, hevyId: id, hevyTitle: spec.title });
      continue;
    }

    throw new Error(resolved.error ?? `Could not resolve custom exercise "${spec.title}" (${slug})`);
  }

  return results;
}

function applyMappingUpdates(mapping, exerciseResults) {
  const newMapping = { ...mapping, mapping: [...(mapping.mapping ?? [])], toCreate: [] };

  for (const upd of exerciseResults) {
    const idx = newMapping.mapping.findIndex((m) => m.slug === upd.slug);
    const row = {
      slug: upd.slug,
      repoTitle: upd.repoTitle,
      hevyId: upd.hevyId,
      hevyTitle: upd.hevyTitle,
      matchScore: 1,
    };
    if (idx >= 0) {
      const prev = newMapping.mapping[idx];
      if (prev.proxyNote) row.proxyNote = prev.proxyNote;
    }
    if (idx >= 0) newMapping.mapping[idx] = row;
    else newMapping.mapping.push(row);
  }

  newMapping.mapping.sort((a, b) => a.slug.localeCompare(b.slug));
  newMapping.matched = newMapping.mapping.length;
  newMapping.generatedAt = new Date().toISOString();
  return newMapping;
}

function resolveExerciseTemplateId(ex, titleToTemplateId) {
  const tid = ex.exercise_template_id;
  if (PLACEHOLDER_TEMPLATE_IDS.has(tid)) {
    const resolved = titleToTemplateId.get(normTitle(ex.title));
    if (!resolved) {
      throw new Error(
        `Missing Hevy template for "${ex.title}" (placeholder id ${tid}). Add to custom-exercises.json and re-run.`
      );
    }
    return resolved;
  }
  return tid;
}

async function ensureRoutineFolders(routinesDoc, manifest, dryRun) {
  const folderNames = new Set();
  if (manifest.routineFolder) folderNames.add(manifest.routineFolder);
  for (const r of routinesDoc.data ?? []) {
    if (r._folder_name && !r.folder_id) folderNames.add(r._folder_name);
  }
  if (folderNames.size === 0) return;

  if (dryRun) {
    for (const name of folderNames) console.log(`[dry-run] Would ensure folder: "${name}"`);
    return;
  }

  const existing = await fetchAllPaginated('routine_folders', { pageSize: 10 });
  const byTitle = new Map();
  for (const f of existing) byTitle.set(normTitle(f.title), f.id);

  for (const name of folderNames) {
    let fid = byTitle.get(normTitle(name));
    if (!fid) {
      const created = await createRoutineFolder(name);
      fid = created?.id;
      console.log(`Created folder: "${name}" → ${fid}`);
      byTitle.set(normTitle(name), fid);
    } else {
      console.log(`Folder exists: "${name}" → ${fid}`);
    }

    for (const r of routinesDoc.data ?? []) {
      if (
        r._folder_name === name ||
        (!r._folder_name && !r.folder_id && manifest.routineFolder === name)
      ) {
        r.folder_id = fid;
      }
    }
  }
}

async function adoptRoutineByTitle(manifest, routineTitle) {
  const { routinesByTitle } = await fetchFolderRoutinesByTitle(manifest.routineFolder ?? '');
  return routinesByTitle.get(normTitle(routineTitle)) ?? null;
}

async function pushRoutines(routinesDoc, manifest, titleToTemplateId, dryRun) {
  const list = [...(routinesDoc.data ?? [])].sort((a, b) => {
    const order = (t) => {
      if (t.includes('Day 1')) return 1;
      if (t.includes('Day 2')) return 2;
      if (t.includes('Day 3')) return 3;
      if (t.includes('Day 4')) return 4;
      if (t.includes('Day 5')) return 5;
      return 99;
    };
    return order(a.title) - order(b.title);
  });

  const idUpdates = new Map();

  for (const routine of list) {
    const exercises = [...routine.exercises]
      .sort((a, b) => a.index - b.index)
      .map((ex) =>
        hevyExerciseToPayload({
          ...ex,
          exercise_template_id: resolveExerciseTemplateId(ex, titleToTemplateId),
        })
      );

    const payload = {
      title: routine.title,
      notes: routine.notes ?? '',
      folderId: routine.folder_id ?? null,
      exercises,
    };

    if (routine.id) {
      if (dryRun) {
        console.log(`[dry-run] Would update routine: ${routine.title} (${routine.id})`);
        continue;
      }

      const updated = await tryUpdateRoutine(routine.id, {
        title: payload.title,
        notes: payload.notes,
        exercises: payload.exercises,
      });

      if (updated) {
        console.log(`Updated routine: ${routine.title} (${routine.id})`);
        continue;
      }

      const adoptedId = await adoptRoutineByTitle(manifest, routine.title);
      if (adoptedId) {
        console.log(
          `Stale id ${routine.id} for "${routine.title}" — adopting live routine ${adoptedId}`
        );
        routine.id = adoptedId;
        const retry = await tryUpdateRoutine(routine.id, {
          title: payload.title,
          notes: payload.notes,
          exercises: payload.exercises,
        });
        if (retry) {
          console.log(`Updated routine: ${routine.title} (${routine.id})`);
          continue;
        }
      }

      throw new Error(
        `Cannot update or adopt routine "${routine.title}". ` +
          `Remove orphan routines in Hevy (npm run hevy:list-folder -- ${manifest.id}) before creating another copy.`
      );
    }

    const existingId = await adoptRoutineByTitle(manifest, routine.title);
    if (existingId) {
      if (dryRun) {
        console.log(
          `[dry-run] Would adopt and update routine: ${routine.title} (${existingId})`
        );
        continue;
      }
      routine.id = existingId;
      const updated = await tryUpdateRoutine(routine.id, {
        title: payload.title,
        notes: payload.notes,
        exercises: payload.exercises,
      });
      if (updated) {
        console.log(`Adopted and updated routine: ${routine.title} (${routine.id})`);
        continue;
      }
      throw new Error(`Failed to update adopted routine "${routine.title}" (${existingId})`);
    }

    if (dryRun) {
      console.log(`[dry-run] Would create routine: ${routine.title}`);
      continue;
    }

    const created = await createRoutine(payload);
    const newId = created?.id;
    if (!newId) {
      console.error('Create routine response:', created);
      throw new Error(`No id in create response for ${routine.title}`);
    }
    console.log(`Created routine: ${routine.title} → ${newId}`);
    idUpdates.set(routine.title, newId);
  }

  return idUpdates;
}

function applyRoutineIds(routinesDoc, idUpdates) {
  const next = JSON.parse(JSON.stringify(routinesDoc));
  for (const r of next.data ?? []) {
    if (idUpdates.has(r.title)) {
      r.id = idUpdates.get(r.title);
    }
  }
  next.fetchedAt = new Date().toISOString();
  return next;
}

function applyResolvedTemplateIds(routinesDoc, titleToTemplateId) {
  const next = JSON.parse(JSON.stringify(routinesDoc));
  for (const r of next.data ?? []) {
    for (const ex of r.exercises ?? []) {
      if (PLACEHOLDER_TEMPLATE_IDS.has(ex.exercise_template_id)) {
        ex.exercise_template_id = resolveExerciseTemplateId(ex, titleToTemplateId);
      }
    }
  }
  return next;
}

/**
 * Push one program bundle to Hevy.
 * @param {string} programArg - program slug or path
 * @param {object} [options]
 * @param {object} [options.templateIndex] - shared index across sync runs
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.fetch]
 * @param {boolean} [options.noFetch]
 * @param {boolean} [options.allowCreate]
 * @param {string} [options.forceCreateSlug]
 * @param {boolean} [options.recreateRoutines]
 * @param {boolean} [options.iKnowRecreate]
 * @param {boolean} [options.skipReconcile]
 * @param {boolean} [options.allowDuplicateRoutines]
 * @param {boolean} [options.skipValidation]
 * @param {boolean} [options.refreshCacheAfter]
 */
export async function runPush(programArg, options = {}) {
  const programDir = resolveProgramDir(programArg);
  const bundle = loadBundle(programDir);
  const { manifest, paths } = bundle;
  let { routines, mapping } = bundle;
  const { customExercises } = bundle;

  const dryRun = options.dryRun ?? false;
  const fetch = options.fetch ?? false;
  const noFetch = options.noFetch ?? false;
  const allowCreate = options.allowCreate ?? false;
  const recreateRoutines = options.recreateRoutines ?? false;
  const skipReconcile = options.skipReconcile ?? false;
  const allowDuplicateRoutines = options.allowDuplicateRoutines ?? false;
  const forceCreateSlug = options.forceCreateSlug ?? null;
  const iKnowRecreate = options.iKnowRecreate ?? false;
  const refreshCacheAfter = options.refreshCacheAfter ?? true;

  if (recreateRoutines && !iKnowRecreate) {
    throw new Error(
      '--recreate-routines clears all local routine ids. Pass --i-know-recreate if you intend to reconcile from Hevy.'
    );
  }

  if (fetch && noFetch) {
    throw new Error('Use only one of --fetch or --no-fetch');
  }

  console.log(`Program: ${manifest.id} (${programDir})`);
  if (dryRun) console.log('Dry run — no API writes');
  if (recreateRoutines) {
    console.log('--recreate-routines: will clear local routine ids before reconcile');
  }

  let index = options.templateIndex;
  let fetchedAt = null;

  if (!index) {
    const shouldFetch = fetch || (!noFetch && !dryRun);
    if (noFetch) {
      const loaded = await loadExerciseTemplates({ requireCache: true });
      index = buildTemplateIndexForAccount(loaded.templates, manifest.account);
      fetchedAt = loaded.fetchedAt;
    } else if (shouldFetch && !dryRun) {
      getHevyApiKey();
      const loaded = await loadExerciseTemplates({ fetch: true, writeCache: true });
      index = buildTemplateIndexForAccount(loaded.templates, manifest.account);
      fetchedAt = loaded.fetchedAt;
      console.log(`Fetched ${loaded.templates.length} exercise templates`);
    } else {
      const loaded = await loadExerciseTemplates({});
      if (loaded.templates.length === 0 && !dryRun) {
        getHevyApiKey();
        const refetched = await loadExerciseTemplates({ fetch: true, writeCache: true });
        index = buildTemplateIndexForAccount(refetched.templates, manifest.account);
        fetchedAt = refetched.fetchedAt;
        console.log(`Fetched ${refetched.templates.length} exercise templates (cache was missing)`);
      } else {
        index = buildTemplateIndexForAccount(loaded.templates, manifest.account);
        fetchedAt = loaded.fetchedAt;
        const staleMsg = cacheStaleWarning(fetchedAt);
        if (staleMsg) console.warn(`Warning: ${staleMsg}`);
      }
    }
  }

  if (!options.skipValidation) {
    assertBundleValid(bundle, { templateIndex: index });
  }

  if (!dryRun || fetch) getHevyApiKey();

  const account = loadAccountMapping(manifest.account);
  const accountBySlug = new Map((account?.mapping ?? []).map((m) => [m.slug, m]));
  const programBySlug = new Map((mapping.mapping ?? []).map((m) => [m.slug, m]));
  const createSlugs = allowCreateSlugs(mapping, customExercises, allowCreate);

  const exerciseResults = await ensureCustomExercises({
    mapping,
    customExercises,
    index,
    accountBySlug,
    programBySlug,
    dryRun,
    allowCreateSlugs: createSlugs,
    forceCreateSlug,
  });

  const mappingNext = applyMappingUpdates(mapping, exerciseResults);
  const titleToTemplateId = buildTitleToTemplateId(index);

  if (!skipReconcile) {
    const stats = await reconcileRoutines(routines, manifest, {
      recreate: recreateRoutines,
      skipApiCheck: dryRun,
      allowDuplicateRoutines,
    });
    console.log(
      `Reconcile: cleared=${stats.cleared}, adopted=${stats.adopted}, folderId=${stats.folderId ?? 'n/a'}`
    );
  } else {
    console.log('Skipping routine reconcile (--skip-reconcile)');
  }

  await ensureRoutineFolders(routines, manifest, dryRun);
  const idUpdates = await pushRoutines(routines, manifest, titleToTemplateId, dryRun);

  if (!dryRun) {
    let routinesNext = applyRoutineIds(routines, idUpdates);
    routinesNext = applyResolvedTemplateIds(routinesNext, titleToTemplateId);
    routinesNext.fetchedAt = new Date().toISOString();
    routinesNext.source = `programs/${manifest.account}/${manifest.id}`;

    fs.writeFileSync(paths.mapping, JSON.stringify(mappingNext, null, 2), 'utf8');
    fs.writeFileSync(paths.routines, JSON.stringify(routinesNext, null, 2), 'utf8');

    const accountDoc = loadAccountMapping(manifest.account);
    const merged = mergeAccountMapping(accountDoc, mappingNext);
    const accountFile = saveAccountMapping(manifest.account, merged);

    console.log('\nWrote', paths.mapping);
    console.log('Wrote', paths.routines);
    console.log('Wrote', accountFile);

    if (refreshCacheAfter) {
      const refreshed = await loadExerciseTemplates({ fetch: true, writeCache: true });
      console.log(`Refreshed exercise cache (${refreshed.templates.length} templates)`);
    }
  } else {
    console.log('\nDry run complete.');
  }

  return { templateIndex: index, mappingNext };
}

async function main() {
  const args = parsePushArgs(process.argv.slice(2));
  if (!args.programArg) {
    console.error('Program path required.\nExample: npm run hevy:push -- push-pull-homegym');
    process.exit(1);
  }

  await runPush(args.programArg, {
    dryRun: args.dryRun,
    fetch: args.fetch,
    noFetch: args.noFetch,
    allowCreate: args.allowCreate,
    forceCreateSlug: args.forceCreateSlug,
    recreateRoutines: args.recreateRoutines,
    iKnowRecreate: args.iKnowRecreate,
    skipReconcile: args.skipReconcile,
    allowDuplicateRoutines: args.allowDuplicateRoutines,
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
