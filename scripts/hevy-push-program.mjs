#!/usr/bin/env node
/**
 * Push custom exercise templates (from exercise-mapping toCreate) and routines
 * from libs/hevy/data/routines.json to the Hevy API (khoiphan21 key).
 *
 * Usage: npm run hevy:push
 *
 * After a successful run, updates local libs/hevy/data/routines.json (new routine IDs)
 * and libs/hevy/data/exercise-mapping.json (new template IDs, clears toCreate).
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../libs/hevy/data');
const ROUTINES_PATH = path.join(DATA_DIR, 'routines.json');
const MAPPING_PATH = path.join(DATA_DIR, 'exercise-mapping.json');

/** Repo slug → Hevy custom exercise POST body (titles match exercises-to-create / mapping) */
const TO_CREATE_SPECS = {
  'band-high-to-low-row': {
    title: 'Band High-to-Low Row',
    exerciseType: 'reps_only',
    equipmentCategory: 'resistance_band',
    muscleGroup: 'upper_back',
    otherMuscles: ['lats', 'biceps'],
  },
  'dragon-flag-negatives': {
    title: 'Dragon Flag Negatives',
    exerciseType: 'reps_only',
    equipmentCategory: 'none',
    muscleGroup: 'abdominals',
    otherMuscles: [],
  },
  'reverse-fly-band': {
    title: 'Reverse Fly (band)',
    exerciseType: 'reps_only',
    equipmentCategory: 'resistance_band',
    muscleGroup: 'shoulders',
    otherMuscles: ['upper_back'],
  },
  'ring-knee-tucks': {
    title: 'Ring Knee Tucks',
    exerciseType: 'reps_only',
    equipmentCategory: 'suspension',
    muscleGroup: 'abdominals',
    otherMuscles: [],
  },
  'wide-grip-inverted-row': {
    title: 'Wide-Grip Inverted Row',
    exerciseType: 'reps_only',
    equipmentCategory: 'none',
    muscleGroup: 'lats',
    otherMuscles: ['upper_back', 'biceps'],
  },
  'chest-to-wall-handstand-hold': {
    title: 'Chest-to-Wall Handstand Hold',
    exerciseType: 'duration',
    equipmentCategory: 'none',
    muscleGroup: 'shoulders',
    otherMuscles: ['triceps', 'abdominals'],
  },
  'freestanding-handstand-hold': {
    title: 'Freestanding Handstand Hold',
    exerciseType: 'duration',
    equipmentCategory: 'none',
    muscleGroup: 'shoulders',
    otherMuscles: ['triceps', 'abdominals'],
  },
  'overhead-press-cable-gm2': {
    title: 'Overhead Press (Cable, Gym Monster 2)',
    exerciseType: 'weight_reps',
    equipmentCategory: 'machine',
    muscleGroup: 'shoulders',
    otherMuscles: ['triceps'],
  },
  'incline-bench-press-cable-gm2': {
    title: 'Incline Bench Press (Cable, Gym Monster 2)',
    exerciseType: 'weight_reps',
    equipmentCategory: 'machine',
    muscleGroup: 'chest',
    otherMuscles: ['shoulders', 'triceps'],
  },
  'band-assisted-high-pull-up': {
    title: 'Band-assisted High Pull-Up',
    exerciseType: 'bodyweight_assisted_reps',
    equipmentCategory: 'resistance_band',
    muscleGroup: 'lats',
    otherMuscles: ['upper_back', 'biceps', 'shoulders'],
  },
};

/** Slugs to ensure on every push even when toCreate is empty (program-specific customs). */
const ADDITIONAL_PUSH_SLUGS = [
  'chest-to-wall-handstand-hold',
  'freestanding-handstand-hold',
  'overhead-press-cable-gm2',
  'incline-bench-press-cable-gm2',
];

const PLACEHOLDER_TEMPLATE_IDS = new Set(['00000000-0000-0000-0000-000000000001']);

function normTitle(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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

async function ensureCustomExercises(mapping, templatesByTitle) {
  const created = [];
  const seen = new Set();
  const queue = [];

  for (const entry of mapping.toCreate ?? []) {
    queue.push({ slug: entry.slug, repoTitle: entry.title });
    seen.add(entry.slug);
  }
  for (const slug of ADDITIONAL_PUSH_SLUGS) {
    if (!seen.has(slug)) {
      const spec = TO_CREATE_SPECS[slug];
      queue.push({ slug, repoTitle: spec?.title ?? slug });
      seen.add(slug);
    }
  }

  for (const { slug, repoTitle } of queue) {
    const spec = TO_CREATE_SPECS[slug];
    if (!spec) {
      console.warn(`No TO_CREATE_SPECS for slug ${slug}, skipping`);
      continue;
    }
    const key = normTitle(spec.title);
    const existing = templatesByTitle.get(key);
    if (existing) {
      console.log(`Exercise exists: "${spec.title}" → ${existing.id}`);
      created.push({ slug, repoTitle, hevyId: existing.id, hevyTitle: existing.title });
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
  const newMapping = { ...mapping, mapping: [...mapping.mapping], toCreate: [] };

  for (const upd of exerciseResults) {
    const idx = newMapping.mapping.findIndex((m) => m.slug === upd.slug);
    const row = {
      slug: upd.slug,
      repoTitle: upd.repoTitle,
      hevyId: upd.hevyId,
      hevyTitle: upd.hevyTitle,
      matchScore: 1,
    };
    if (idx >= 0) newMapping.mapping[idx] = row;
    else newMapping.mapping.push(row);
  }

  newMapping.mapping.sort((a, b) => a.slug.localeCompare(b.slug));
  newMapping.matched = newMapping.mapping.length;
  newMapping.generatedAt = new Date().toISOString();
  return newMapping;
}

function buildTitleToTemplateId(templatesByTitle) {
  const m = new Map();
  for (const [k, v] of templatesByTitle) {
    m.set(k, v.id);
  }
  return m;
}

function resolveExerciseTemplateId(ex, titleToTemplateId) {
  let tid = ex.exercise_template_id;
  if (PLACEHOLDER_TEMPLATE_IDS.has(tid)) {
    const resolved = titleToTemplateId.get(normTitle(ex.title));
    if (!resolved) {
      throw new Error(
        `Missing Hevy template for "${ex.title}" (placeholder id ${tid}). Add TO_CREATE_SPECS and re-run.`
      );
    }
    return resolved;
  }
  return tid;
}

async function ensureRoutineFolders(routinesDoc) {
  const folderNames = new Set();
  for (const r of routinesDoc.data ?? []) {
    if (r._folder_name && !r.folder_id) folderNames.add(r._folder_name);
  }
  if (folderNames.size === 0) return;

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
      if (r._folder_name === name) r.folder_id = fid;
    }
  }
}

async function pushRoutines(routinesDoc, titleToTemplateId) {
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
      await updateRoutine(routine.id, {
        title: payload.title,
        notes: payload.notes,
        exercises: payload.exercises,
      });
      console.log(`Updated routine: ${routine.title} (${routine.id})`);
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
  getHevyApiKey();

  const routinesDoc = JSON.parse(fs.readFileSync(ROUTINES_PATH, 'utf8'));
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));

  const templates = await fetchAllPaginated('exercise_templates', { pageSize: 100 });
  const templatesByTitle = new Map();
  for (const t of templates) {
    templatesByTitle.set(normTitle(t.title), { id: t.id, title: t.title });
  }

  const exerciseResults = await ensureCustomExercises(mapping, templatesByTitle);
  const mappingNext = applyMappingUpdates(mapping, exerciseResults);
  const titleToTemplateId = buildTitleToTemplateId(templatesByTitle);

  await ensureRoutineFolders(routinesDoc);
  const idUpdates = await pushRoutines(routinesDoc, titleToTemplateId);
  let routinesNext = applyRoutineIds(routinesDoc, idUpdates);
  routinesNext = applyResolvedTemplateIds(routinesNext, titleToTemplateId);
  routinesNext.fetchedAt = new Date().toISOString();

  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mappingNext, null, 2), 'utf8');
  fs.writeFileSync(ROUTINES_PATH, JSON.stringify(routinesNext, null, 2), 'utf8');

  console.log('\nWrote', MAPPING_PATH, 'and', ROUTINES_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
