/**
 * Reconcile local routines.json IDs with live Hevy folder state.
 */

import { fetchAllPaginated, fetchRoutineById, hevyThrottle } from './hevy-client.mjs';
import { normTitle } from './program-bundle.mjs';

/**
 * @param {string} folderName
 * @returns {Promise<{ folderId: string|null, routinesByTitle: Map<string, string>, ambiguousTitles: string[] }>}
 */
export async function fetchFolderRoutinesByTitle(folderName) {
  const folders = await fetchAllPaginated('routine_folders', { pageSize: 10 });
  const folder = folders.find((f) => normTitle(f.title) === normTitle(folderName));

  if (!folder) {
    return { folderId: null, routinesByTitle: new Map(), ambiguousTitles: [] };
  }

  const allRoutines = await fetchAllPaginated('routines', { pageSize: 10 });
  const inFolder = allRoutines.filter((r) => r.folder_id === folder.id);
  const idsByTitle = new Map();

  for (const r of inFolder) {
    const key = normTitle(r.title);
    if (!idsByTitle.has(key)) idsByTitle.set(key, []);
    idsByTitle.get(key).push({ id: r.id, title: r.title });
  }

  const routinesByTitle = new Map();
  const ambiguousTitles = [];

  for (const [key, entries] of idsByTitle) {
    if (entries.length > 1) {
      ambiguousTitles.push(entries[0].title);
    } else {
      routinesByTitle.set(key, entries[0].id);
    }
  }

  return { folderId: folder.id, routinesByTitle, ambiguousTitles };
}

/**
 * Mutates routines in routinesDoc.data in place.
 * @param {object} routinesDoc
 * @param {object} manifest
 * @param {object} options
 * @param {boolean} [options.recreate] - clear all ids first
 * @param {boolean} [options.skipApiCheck] - dry-run: only title-based adoption
 * @param {boolean} [options.allowDuplicateRoutines] - skip ambiguous title errors
 * @returns {Promise<{ cleared: number, adopted: number, folderId: string|null, ambiguousTitles: string[] }>}
 */
export async function reconcileRoutines(routinesDoc, manifest, options = {}) {
  const { recreate = false, skipApiCheck = false, allowDuplicateRoutines = false } = options;
  let cleared = 0;
  let adopted = 0;

  if (recreate) {
    for (const r of routinesDoc.data ?? []) {
      r.id = null;
      r.folder_id = null;
    }
    cleared = routinesDoc.data?.length ?? 0;
  }

  const { folderId, routinesByTitle, ambiguousTitles } = await fetchFolderRoutinesByTitle(
    manifest.routineFolder ?? ''
  );

  if (!allowDuplicateRoutines && ambiguousTitles.length > 0) {
    throw new Error(
      `Duplicate routine titles in Hevy folder "${manifest.routineFolder}": ${ambiguousTitles.join(', ')}. ` +
        `Remove orphans (npm run hevy:list-folder -- ${manifest.id}) or pass --allow-duplicate-routines.`
    );
  }

  if (folderId) {
    for (const r of routinesDoc.data ?? []) {
      if (!r.folder_id) r.folder_id = folderId;
    }
  }

  for (const routine of routinesDoc.data ?? []) {
    const titleKey = normTitle(routine.title);

    if (routine.id && !skipApiCheck) {
      const live = await fetchRoutineById(routine.id);
      await hevyThrottle();
      if (!live) {
        console.log(
          `Reconcile: stale id for "${routine.title}" (${routine.id}) — will adopt by title or create`
        );
        routine.id = null;
        cleared += 1;
      } else if (normTitle(live.title) !== titleKey) {
        console.log(
          `Reconcile: id ${routine.id} is "${live.title}", expected "${routine.title}" — clearing id`
        );
        routine.id = null;
        cleared += 1;
      }
    }

    if (!routine.id && routinesByTitle.has(titleKey)) {
      const hevyId = routinesByTitle.get(titleKey);
      console.log(`Reconcile: adopt "${routine.title}" → ${hevyId}`);
      routine.id = hevyId;
      adopted += 1;
    }
  }

  return { cleared, adopted, folderId, ambiguousTitles };
}

/**
 * @param {object} routinesDoc
 */
export function clearRoutineIds(routinesDoc) {
  for (const r of routinesDoc.data ?? []) {
    r.id = null;
    r.folder_id = null;
  }
}
