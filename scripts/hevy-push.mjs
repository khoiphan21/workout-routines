#!/usr/bin/env node
/**
 * Push a program bundle to Hevy: custom exercises + routines.
 *
 * Usage:
 *   npm run hevy:push -- push-pull-homegym
 *   npm run hevy:push -- programs/khoiphan21/push-pull-gym-monster-2
 *   npm run hevy:push -- push-pull-homegym --dry-run
 *   npm run hevy:push -- push-pull-homegym --fetch
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
  updateRoutine,
} from '../libs/hevy/hevy-client.mjs';
import {
  CACHE_DIR,
  loadAccountMapping,
  loadBundle,
  mergeAccountMapping,
  normTitle,
  resolveProgramDir,
  saveAccountMapping,
} from '../libs/hevy/program-bundle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER_TEMPLATE_IDS = new Set(['00000000-0000-0000-0000-000000000001']);
const TEMPLATES_CACHE = path.join(CACHE_DIR, 'exercise-templates.json');

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  for (const a of argv) {
    if (a.startsWith('-')) flags.add(a);
    else positional.push(a);
  }
  return {
    programArg: positional[0],
    dryRun: flags.has('--dry-run'),
    fetch: flags.has('--fetch'),
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

async function loadTemplatesFromCache(fetch, dryRun) {
  if (fetch) {
    getHevyApiKey();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const items = await fetchAllPaginated('exercise_templates', { pageSize: 100 });
    fs.writeFileSync(
      TEMPLATES_CACHE,
      JSON.stringify(
        { fetchedAt: new Date().toISOString(), count: items.length, data: items },
        null,
        2
      ),
      'utf8'
    );
    console.log(`Cached ${items.length} exercise templates → ${TEMPLATES_CACHE}`);
    return items;
  }

  if (!fs.existsSync(TEMPLATES_CACHE)) {
    throw new Error(
      `Missing ${TEMPLATES_CACHE}. Run: npm run hevy:fetch-exercises (or hevy:push --fetch)`
    );
  }

  const raw = JSON.parse(fs.readFileSync(TEMPLATES_CACHE, 'utf8'));
  return raw.data ?? raw;
}

function buildTemplatesByTitle(templates) {
  const m = new Map();
  for (const t of templates) {
    m.set(normTitle(t.title), { id: t.id, title: t.title });
  }
  return m;
}

function buildTitleToTemplateId(templatesByTitle) {
  const m = new Map();
  for (const [k, v] of templatesByTitle) {
    m.set(k, v.id);
  }
  return m;
}

async function ensureCustomExercises(mapping, customExercises, templatesByTitle, dryRun) {
  const created = [];
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
    const key = normTitle(spec.title);
    const existing = templatesByTitle.get(key);
    if (existing) {
      console.log(`Exercise exists: "${spec.title}" → ${existing.id}`);
      created.push({ slug, repoTitle, hevyId: existing.id, hevyTitle: existing.title });
      continue;
    }

    if (dryRun) {
      const fakeId = `dry-run-${slug}`;
      console.log(`[dry-run] Would create exercise: "${spec.title}"`);
      templatesByTitle.set(key, { id: fakeId, title: spec.title });
      created.push({ slug, repoTitle, hevyId: fakeId, hevyTitle: spec.title });
      continue;
    }

    const { id } = await createExerciseTemplate(spec);
    console.log(`Created exercise: "${spec.title}" → ${id}`);
    templatesByTitle.set(key, { id, title: spec.title });
    created.push({ slug, repoTitle, hevyId: id, hevyTitle: spec.title });
  }

  return created;
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
  let tid = ex.exercise_template_id;
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

async function pushRoutines(routinesDoc, titleToTemplateId, dryRun) {
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
      } else {
        await updateRoutine(routine.id, {
          title: payload.title,
          notes: payload.notes,
          exercises: payload.exercises,
        });
        console.log(`Updated routine: ${routine.title} (${routine.id})`);
      }
    } else {
      if (dryRun) {
        console.log(`[dry-run] Would create routine: ${routine.title}`);
      } else {
        const created = await createRoutine(payload);
        const newId = created?.id;
        if (!newId) {
          console.error('Create routine response:', created);
          throw new Error(`No id in create response for ${routine.title}`);
        }
        console.log(`Created routine: ${routine.title} → ${newId}`);
        idUpdates.set(routine.title, newId);
      }
    }
  }

  return idUpdates;
}

function applyRoutineIds(routinesDoc, idUpdates) {
  const next = JSON.parse(JSON.stringify(routinesDoc));
  for (const r of next.data ?? []) {
    if (!r.id && idUpdates.has(r.title)) {
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

async function main() {
  const { programArg, dryRun, fetch } = parseArgs(process.argv.slice(2));
  const programDir = resolveProgramDir(programArg);
  const bundle = loadBundle(programDir);
  const { manifest, paths } = bundle;
  let { routines, mapping } = bundle;
  const { customExercises } = bundle;

  console.log(`Program: ${manifest.id} (${programDir})`);
  if (dryRun) console.log('Dry run — no API writes');

  if (!dryRun || fetch) getHevyApiKey();

  const templates = await loadTemplatesFromCache(fetch, dryRun);
  const templatesByTitle = buildTemplatesByTitle(templates);

  const exerciseResults = await ensureCustomExercises(
    mapping,
    customExercises,
    templatesByTitle,
    dryRun
  );
  const mappingNext = applyMappingUpdates(mapping, exerciseResults);
  const titleToTemplateId = buildTitleToTemplateId(templatesByTitle);

  await ensureRoutineFolders(routines, manifest, dryRun);
  const idUpdates = await pushRoutines(routines, titleToTemplateId, dryRun);

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
  } else {
    console.log('\nDry run complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
