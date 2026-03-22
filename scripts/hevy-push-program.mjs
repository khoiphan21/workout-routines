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
};

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
  const toCreate = mapping.toCreate ?? [];

  for (const entry of toCreate) {
    const slug = entry.slug;
    const spec = TO_CREATE_SPECS[slug];
    if (!spec) {
      console.warn(`No TO_CREATE_SPECS for slug ${slug}, skipping`);
      continue;
    }
    const key = normTitle(spec.title);
    const existing = templatesByTitle.get(key);
    if (existing) {
      console.log(`Exercise exists: "${spec.title}" → ${existing.id}`);
      created.push({ slug, repoTitle: entry.title, hevyId: existing.id, hevyTitle: existing.title });
      continue;
    }

    const { id } = await createExerciseTemplate(spec);
    console.log(`Created exercise: "${spec.title}" → ${id}`);
    templatesByTitle.set(key, { id, title: spec.title });
    created.push({ slug, repoTitle: entry.title, hevyId: id, hevyTitle: spec.title });
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
  newMapping.matched = newMapping.repoExerciseCount;
  newMapping.generatedAt = new Date().toISOString();
  return newMapping;
}

async function pushRoutines(routinesDoc) {
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
    const exercises = [...routine.exercises].sort((a, b) => a.index - b.index).map(hevyExerciseToPayload);

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

  const idUpdates = await pushRoutines(routinesDoc);
  const routinesNext = applyRoutineIds(routinesDoc, idUpdates);

  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mappingNext, null, 2), 'utf8');
  fs.writeFileSync(ROUTINES_PATH, JSON.stringify(routinesNext, null, 2), 'utf8');

  console.log('\nWrote', MAPPING_PATH, 'and', ROUTINES_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
