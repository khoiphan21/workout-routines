#!/usr/bin/env node
/**
 * List routines in a program's Hevy folder; mark duplicates vs routines.json IDs.
 *
 * Usage: npm run hevy:list-folder -- push-pull-gym-monster-2
 */

import fs from 'node:fs';
import {
  fetchAllPaginated,
  getHevyApiKey,
} from '../libs/hevy/hevy-client.mjs';
import {
  loadBundle,
  loadManifest,
  normTitle,
  resolveProgramDir,
} from '../libs/hevy/program-bundle.mjs';

function norm(s) {
  return normTitle(s);
}

async function main() {
  const programArg = process.argv[2];
  if (!programArg) {
    console.error('Usage: node scripts/hevy-list-folder-routines.mjs <program>');
    process.exit(1);
  }

  getHevyApiKey();
  const programDir = resolveProgramDir(programArg);
  const manifest = loadManifest(programDir);
  const { routines } = loadBundle(programDir);

  const canonicalByTitle = new Map();
  const canonicalIds = new Set();
  for (const r of routines.data ?? []) {
    if (r.id) {
      canonicalIds.add(r.id);
      canonicalByTitle.set(norm(r.title), r.id);
    }
  }

  const folders = await fetchAllPaginated('routine_folders', { pageSize: 10 });
  const folder = folders.find((f) => norm(f.title) === norm(manifest.routineFolder));
  if (!folder) {
    console.error(`Folder not found: "${manifest.routineFolder}"`);
    process.exit(1);
  }

  const allRoutines = await fetchAllPaginated('routines', { pageSize: 10 });
  const inFolder = allRoutines.filter((r) => r.folder_id === folder.id);

  console.log(`\nFolder: ${manifest.routineFolder} (${folder.id})`);
  console.log(`Routines on Hevy: ${inFolder.length}`);
  console.log(`Canonical in repo: ${canonicalIds.size}\n`);

  const keep = [];
  const duplicates = [];

  for (const r of inFolder.sort((a, b) => a.title.localeCompare(b.title))) {
    const isCanonical = canonicalIds.has(r.id);
    const row = { title: r.title, id: r.id, keep: isCanonical };
    if (isCanonical) keep.push(row);
    else duplicates.push(row);
  }

  if (keep.length) {
    console.log('KEEP (match programs/.../hevy/routines.json):');
    for (const r of keep) console.log(`  ✓ ${r.title}\n    ${r.id}`);
  }

  if (duplicates.length) {
    console.log('\nDELETE in Hevy app (duplicates / orphaned — no matching repo id):');
    for (const r of duplicates) console.log(`  ✗ ${r.title}\n    ${r.id}`);
    console.log(
      '\nHevy API has no delete-routine endpoint; remove these manually in the app.'
    );
  } else {
    console.log('\nNo duplicates detected.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
