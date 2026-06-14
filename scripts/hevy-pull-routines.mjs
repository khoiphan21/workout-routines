#!/usr/bin/env node
/**
 * Refresh per-program hevy/routines.json snapshots from the fetched Hevy cache.
 *
 * Run `npm run hevy:fetch` first so libs/hevy/cache/routines-all.json and
 * routine-folders.json reflect the latest Hevy account state.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  CACHE_DIR,
  listProgramDirs,
  loadBundle,
  normTitle,
  programSlugFromDir,
  resolveProgramDir,
} from '../libs/hevy/program-bundle.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function loadCache() {
  const routinesPath = path.join(CACHE_DIR, 'routines-all.json');
  const foldersPath = path.join(CACHE_DIR, 'routine-folders.json');

  if (!fs.existsSync(routinesPath) || !fs.existsSync(foldersPath)) {
    throw new Error('Missing Hevy cache. Run: npm run hevy:fetch');
  }

  return {
    routines: readJson(routinesPath),
    folders: readJson(foldersPath),
  };
}

function folderMaps(folders) {
  const byId = new Map();
  const byTitle = new Map();

  for (const folder of folders.data ?? []) {
    byId.set(folder.id, folder);
    byTitle.set(normTitle(folder.title), folder);
  }

  return { byId, byTitle };
}

function routineSortValue(title) {
  const value = String(title ?? '');
  const dayMatch = value.match(/Day\s+(\d+)/i);
  if (dayMatch) return `0-${String(dayMatch[1]).padStart(2, '0')}-${value}`;
  if (value.startsWith('Mini ')) return `1-${value}`;
  return `2-${value}`;
}

function cloneLiveRoutine(live, folderById) {
  const next = JSON.parse(JSON.stringify(live));
  const folder = folderById.get(next.folder_id);

  if (folder?.title) {
    next._folder_name = folder.title;
  } else {
    delete next._folder_name;
  }

  return next;
}

function refreshProgram(bundle, cache, folderById, folderByTitle) {
  const { manifest, routines: existing, paths } = bundle;
  const liveById = new Map((cache.routines.data ?? []).map((r) => [r.id, r]));
  const selected = [];
  const selectedIds = new Set();
  const missingIds = [];

  const existingIds = new Set(
    (existing.data ?? []).map((routine) => routine.id).filter(Boolean)
  );
  const folderIds = new Set(
    (existing.data ?? [])
      .map((routine) => routine.folder_id)
      .filter((folderId) => folderId != null)
  );

  const manifestFolder = folderByTitle.get(normTitle(manifest.routineFolder ?? ''));
  if (manifestFolder?.id != null) folderIds.add(manifestFolder.id);

  for (const oldRoutine of existing.data ?? []) {
    const live = liveById.get(oldRoutine.id);
    if (!live) {
      if (oldRoutine.id) missingIds.push(`${oldRoutine.title} (${oldRoutine.id})`);
      continue;
    }
    selected.push(cloneLiveRoutine(live, folderById));
    selectedIds.add(live.id);
  }

  const additions = (cache.routines.data ?? [])
    .filter((routine) => !selectedIds.has(routine.id))
    .filter(
      (routine) =>
        existingIds.has(routine.id) ||
        (routine.folder_id != null && folderIds.has(routine.folder_id))
    )
    .sort((a, b) =>
      routineSortValue(a.title).localeCompare(routineSortValue(b.title))
    );

  for (const routine of additions) {
    selected.push(cloneLiveRoutine(routine, folderById));
    selectedIds.add(routine.id);
  }

  if (selected.length === 0) {
    throw new Error(`No live routines matched ${manifest.id}; leaving ${paths.routines} unchanged`);
  }

  const next = {
    fetchedAt: cache.routines.fetchedAt ?? new Date().toISOString(),
    source: `programs/${manifest.account}/${manifest.id}`,
    count: selected.length,
    data: selected,
  };

  writeJson(paths.routines, next);

  return {
    id: manifest.id,
    file: paths.routines,
    count: selected.length,
    missingIds,
  };
}

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('-'));
  return { programs: positional };
}

async function main() {
  const { programs } = parseArgs(process.argv.slice(2));
  const cache = loadCache();
  const { byId: folderById, byTitle: folderByTitle } = folderMaps(cache.folders);

  const programDirs =
    programs.length > 0
      ? programs.map(resolveProgramDir)
      : listProgramDirs().sort((a, b) => programSlugFromDir(a).localeCompare(programSlugFromDir(b)));

  if (programDirs.length === 0) {
    throw new Error('No program bundles found');
  }

  for (const programDir of programDirs) {
    const bundle = loadBundle(programDir);
    const result = refreshProgram(bundle, cache, folderById, folderByTitle);
    console.log(`Wrote ${result.count} routine(s): ${result.file}`);
    if (result.missingIds.length > 0) {
      console.warn(`Missing on Hevy for ${result.id}:`);
      for (const item of result.missingIds) console.warn(`  - ${item}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
