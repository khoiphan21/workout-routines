/**
 * Reconcile local routines.json IDs with live Hevy folder state.
 */

import { fetchAllPaginated, fetchRoutineById, hevyThrottle } from './hevy-client.mjs';
import { normTitle } from './program-bundle.mjs';

/**
 * @param {string} folderName
 * @returns {Promise<{ folderId: string|null, routinesByTitle: Map<string, string> }>}
 */
export async function fetchFolderRoutinesByTitle(folderName) {
  const folders = await fetchAllPaginated('routine_folders', { pageSize: 10 });
  const folder = folders.find((f) => normTitle(f.title) === normTitle(folderName));

  if (!folder) {
    return { folderId: null, routinesByTitle: new Map() };
  }

  const allRoutines = await fetchAllPaginated('routines', { pageSize: 10 });
  const inFolder = allRoutines.filter((r) => r.folder_id === folder.id);
  const routinesByTitle = new Map();
  for (const r of inFolder) {
    routinesByTitle.set(normTitle(r.title), r.id);
  }

  return { folderId: folder.id, routinesByTitle };
}

/**
 * Mutates routines in routinesDoc.data in place.
 * @param {object} routinesDoc
 * @param {object} manifest
 * @param {object} options
 * @param {boolean} [options.recreate] - clear all ids first
 * @param {boolean} [options.skipApiCheck] - dry-run: only title-based adoption
 * @returns {Promise<{ cleared: number, adopted: number, folderId: string|null }>}
 */
export async function reconcileRoutines(routinesDoc, manifest, options = {}) {
  const { recreate = false, skipApiCheck = false } = options;
  let cleared = 0;
  let adopted = 0;

  if (recreate) {
    for (const r of routinesDoc.data ?? []) {
      r.id = null;
      r.folder_id = null;
    }
    cleared = routinesDoc.data?.length ?? 0;
  }

  const { folderId, routinesByTitle } = await fetchFolderRoutinesByTitle(
    manifest.routineFolder ?? ''
  );

  if (folderId) {
    for (const r of routinesDoc.data ?? []) {
      if (!r.folder_id) r.folder_id = folderId;
    }
  }

  for (const routine of routinesDoc.data ?? []) {
    const titleKey = normTitle(routine.title);

    if (routine.id && !skipApiCheck) {
      const exists = await fetchRoutineById(routine.id);
      await hevyThrottle();
      if (!exists) {
        console.log(
          `Reconcile: stale id for "${routine.title}" (${routine.id}) — will create or adopt by title`
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

  return { cleared, adopted, folderId };
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
