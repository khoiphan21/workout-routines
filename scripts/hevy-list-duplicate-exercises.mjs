#!/usr/bin/env node
/**
 * List duplicate custom exercise templates on Hevy (same title, multiple IDs).
 * Default output: DELETE ids only (safe to remove in the Hevy app).
 *
 * Hevy API has no DELETE for exercise_templates — remove duplicates in the app.
 *
 * Usage:
 *   npm run hevy:list-duplicates
 *   npm run hevy:list-duplicates -- --fetch
 *   npm run hevy:list-duplicates -- --verbose   # show KEEP + grouped sections
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE_DIR,
  listProgramsForAccount,
  loadBundle,
  loadManifest,
  normTitle,
} from '../libs/hevy/program-bundle.mjs';
import { fetchAllPaginated, getHevyApiKey } from '../libs/hevy/hevy-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCOUNT = 'khoiphan21';
const PLACEHOLDER = '00000000-0000-0000-0000-000000000001';
const CACHE_FILE = path.join(CACHE_DIR, 'exercise-templates.json');

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('-')));
  return {
    fetch: flags.has('--fetch'),
    verbose: flags.has('--verbose'),
  };
}

function collectCanonicalIds(account) {
  const ids = new Set();
  const idSources = new Map();
  const preferredByTitle = new Map();
  const preferredPriority = new Map();
  /** @type {Map<string, { slug: string, programId: string, title: string }>} */
  const slugByPreferredId = new Map();

  function add(id, source) {
    if (!id || id === PLACEHOLDER) return;
    ids.add(id);
    if (!idSources.has(id)) idSources.set(id, []);
    idSources.get(id).push(source);
  }

  function prefer(title, id, priority, meta = {}) {
    const key = normTitle(title);
    const cur = preferredByTitle.get(key);
    if (!cur || priority > (preferredPriority.get(cur) ?? 0)) {
      preferredByTitle.set(key, id);
      preferredPriority.set(id, priority);
      if (meta.slug) slugByPreferredId.set(id, meta);
    }
  }

  const accountMappingPath = path.join(
    CACHE_DIR,
    '../account',
    account,
    'exercise-mapping.json'
  );
  if (fs.existsSync(accountMappingPath)) {
    const doc = JSON.parse(fs.readFileSync(accountMappingPath, 'utf8'));
    for (const row of doc.mapping ?? []) {
      add(row.hevyId, `account mapping: ${row.slug}`);
      if (row.hevyId && row.hevyTitle) {
        prefer(row.hevyTitle, row.hevyId, 2, {
          slug: row.slug,
          programId: 'account',
          title: row.hevyTitle,
        });
      }
    }
  }

  for (const programDir of listProgramsForAccount(account)) {
    const manifest = loadManifest(programDir);
    const bundle = loadBundle(programDir);

    for (const row of bundle.mapping.mapping ?? []) {
      add(row.hevyId, `${manifest.id}/mapping: ${row.slug}`);
      if (row.hevyId && row.hevyTitle) {
        prefer(row.hevyTitle, row.hevyId, 3, {
          slug: row.slug,
          programId: manifest.id,
          title: row.hevyTitle,
        });
      }
    }

    for (const routine of bundle.routines.data ?? []) {
      for (const ex of routine.exercises ?? []) {
        const tid = ex.exercise_template_id;
        if (tid && tid !== PLACEHOLDER) {
          add(tid, `${manifest.id}/routine: ${routine.title} → ${ex.title}`);
          prefer(ex.title, tid, 1);
        }
      }
    }
  }

  return { ids, idSources, preferredByTitle, slugByPreferredId };
}

async function loadTemplates(fetch) {
  if (fetch) {
    getHevyApiKey();
    const items = await fetchAllPaginated('exercise_templates', { pageSize: 100 });
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(
        { fetchedAt: new Date().toISOString(), count: items.length, data: items },
        null,
        2
      ),
      'utf8'
    );
    console.error(`Fetched ${items.length} templates → ${CACHE_FILE}\n`);
    return items;
  }

  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error(`Missing ${CACHE_FILE}. Run with --fetch or: npm run hevy:fetch-exercises`);
  }
  const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  return raw.data ?? raw;
}

async function main() {
  const { fetch, verbose } = parseArgs(process.argv.slice(2));

  if (fetch || !fs.existsSync(CACHE_FILE)) {
    getHevyApiKey();
  }

  const templates = await loadTemplates(fetch);
  const liveIds = new Set(templates.map((t) => t.id));
  const { ids: canonicalIds, idSources, preferredByTitle, slugByPreferredId } =
    collectCanonicalIds(ACCOUNT);

  const customs = templates.filter((t) => t.is_custom === true);
  const byTitle = new Map();

  for (const t of customs) {
    const key = normTitle(t.title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(t);
  }

  const duplicateGroups = [...byTitle.entries()]
    .filter(([, arr]) => arr.length > 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const deleteLines = [];
  const missingKeepers = [];

  for (const [titleKey, preferredId] of preferredByTitle) {
    if (!liveIds.has(preferredId)) {
      const meta = slugByPreferredId.get(preferredId);
      const meta = slugByPreferredId.get(preferredId);
      const title =
        meta?.title ??
        [...byTitle.entries()].find(([k]) => k === titleKey)?.[1]?.[0]?.title ??
        titleKey;
      missingKeepers.push({
        title,
        oldId: preferredId,
        slug: meta?.slug,
        programId: meta?.programId,
      });
    }
  }

  for (const [, group] of duplicateGroups) {
    const displayTitle = group[0].title;
    const titleKey = normTitle(displayTitle);
    const preferredId = preferredByTitle.get(titleKey);
    const toDelete = group.filter((t) => t.id !== preferredId);

    const staleKeep = group.filter(
      (t) => t.id !== preferredId && canonicalIds.has(t.id) && t.id !== preferredId
    );
    for (const t of staleKeep) {
      if (!toDelete.some((d) => d.id === t.id)) toDelete.push(t);
    }

    if (verbose) {
      console.log(`── ${displayTitle} (${group.length} copies) ──`);
      if (preferredId && liveIds.has(preferredId)) {
        const sources = idSources.get(preferredId)?.slice(0, 2).join('; ') ?? '';
        console.log(`  KEEP   ${preferredId}${sources ? `  (${sources})` : ''}`);
      } else if (preferredId) {
        console.log(`  KEEP   ${preferredId}  (missing on Hevy — see RECREATE below)`);
      }
    }

    for (const t of toDelete) {
      if (verbose) {
        console.log(`  DELETE ${t.id}`);
      } else {
        deleteLines.push(`${t.id}  # ${displayTitle}`);
      }
    }

    if (verbose) console.log('');
  }

  if (!verbose) {
    console.log(
      '# Delete these in Hevy: Settings → Exercises → search by title → ⋮ → Delete\n'
    );
    for (const line of deleteLines) {
      console.log(line);
    }
    console.log(`\n# ${deleteLines.length} id(s) to delete`);
  } else {
    console.log(`DELETE ${deleteLines.length} duplicate(s) listed above.`);
  }

  if (missingKeepers.length) {
    console.log('\n# RECREATE (deleted or missing on Hevy — new id assigned on push)\n');
    for (const m of missingKeepers) {
      console.log(`${m.title}`);
      console.log(`  was: ${m.oldId}`);
      if (m.slug && m.programId && m.programId !== 'account') {
        console.log(`  run: npm run hevy:push -- ${m.programId}`);
      } else if (m.slug) {
        console.log(`  run: npm run hevy:push -- push-pull-homegym  # or program that owns this slug`);
      }
      console.log('');
    }
  }

  if (duplicateGroups.length === 0 && missingKeepers.length === 0) {
    console.log('No duplicate custom titles and no missing keepers.');
  } else if (!verbose && duplicateGroups.length === 0 && missingKeepers.length) {
    // only missing keepers, no dup groups
  } else if (!verbose) {
    console.error(
      '\nTip: Hevy cannot restore old UUIDs. After push, commit updated mapping.json / routines.json.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
