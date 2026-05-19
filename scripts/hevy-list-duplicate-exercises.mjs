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

import { getHevyApiKey } from '../libs/hevy/hevy-client.mjs';
import { normTitle } from '../libs/hevy/program-bundle.mjs';
import {
  buildTemplateIndex,
  collectCanonicalIds,
  EXERCISE_TEMPLATES_CACHE,
  loadExerciseTemplates,
} from '../libs/hevy/template-index.mjs';
import fs from 'node:fs';

const ACCOUNT = 'khoiphan21';

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('-')));
  return {
    fetch: flags.has('--fetch'),
    verbose: flags.has('--verbose'),
  };
}

async function main() {
  const { fetch, verbose } = parseArgs(process.argv.slice(2));

  if (fetch || !fs.existsSync(EXERCISE_TEMPLATES_CACHE)) {
    getHevyApiKey();
  }

  const { templates } = await loadExerciseTemplates({ fetch, writeCache: fetch });
  if (fetch) {
    console.error(`Fetched ${templates.length} templates → ${EXERCISE_TEMPLATES_CACHE}\n`);
  }

  const canonical = collectCanonicalIds(ACCOUNT);
  const index = buildTemplateIndex(templates, canonical);
  const { ids: canonicalIds, idSources, preferredByTitle, slugByPreferredId } = canonical;
  const liveIds = index.liveIds;

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
        console.log(
          `  run: npm run hevy:push -- push-pull-homegym  # or program that owns this slug`
        );
      }
      console.log('');
    }
  }

  if (duplicateGroups.length === 0 && missingKeepers.length === 0) {
    console.log('No duplicate custom titles and no missing keepers.');
  } else if (!verbose && duplicateGroups.length > 0) {
    console.error(
      '\nTip: Hevy cannot restore old UUIDs. After push, commit updated mapping.json / routines.json.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
