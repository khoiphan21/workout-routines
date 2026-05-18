/**
 * Validate program Hevy bundles before API push.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, normTitle } from './program-bundle.mjs';

export const PLACEHOLDER_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';

export const MUSCLE_GROUPS = new Set([
  'abdominals',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'calves',
  'glutes',
  'abductors',
  'adductors',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'chest',
  'cardio',
  'neck',
  'full_body',
  'other',
]);

export const EXERCISE_TYPES = new Set([
  'weight_reps',
  'reps_only',
  'bodyweight_reps',
  'bodyweight_assisted_reps',
  'duration',
  'weight_duration',
  'distance_duration',
  'short_distance_weight',
]);

export const EQUIPMENT_CATEGORIES = new Set([
  'none',
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'plate',
  'resistance_band',
  'suspension',
  'other',
]);

/**
 * @param {object} customExercises - custom-exercises.json object
 * @returns {string[]} Error messages (empty if valid)
 */
export function validateCustomExercises(customExercises) {
  const errors = [];

  for (const [slug, spec] of Object.entries(customExercises ?? {})) {
    const prefix = `custom-exercises.json["${slug}"]`;

    if (!spec?.title?.trim()) {
      errors.push(`${prefix}: missing title`);
      continue;
    }
    if (!EXERCISE_TYPES.has(spec.exerciseType)) {
      errors.push(
        `${prefix}: invalid exerciseType "${spec.exerciseType}" (allowed: ${[...EXERCISE_TYPES].join(', ')})`
      );
    }
    if (!EQUIPMENT_CATEGORIES.has(spec.equipmentCategory)) {
      errors.push(
        `${prefix}: invalid equipmentCategory "${spec.equipmentCategory}"`
      );
    }
    if (!MUSCLE_GROUPS.has(spec.muscleGroup)) {
      errors.push(
        `${prefix}: invalid muscleGroup "${spec.muscleGroup}" (use e.g. lats, upper_back, lower_back — not "back")`
      );
    }
    if (spec.otherMuscles != null) {
      if (!Array.isArray(spec.otherMuscles)) {
        errors.push(`${prefix}: otherMuscles must be an array`);
      } else {
        for (const m of spec.otherMuscles) {
          if (!MUSCLE_GROUPS.has(m)) {
            errors.push(`${prefix}: invalid otherMuscles entry "${m}"`);
          }
        }
      }
    }
  }

  return errors;
}

function loadTemplatesByTitle() {
  const cachePath = path.join(CACHE_DIR, 'exercise-templates.json');
  if (!fs.existsSync(cachePath)) {
    return { byTitle: new Map(), error: `Missing ${cachePath}. Run: npm run hevy:fetch-exercises` };
  }
  const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const arr = raw.data ?? raw;
  const byTitle = new Map();
  for (const t of arr) {
    byTitle.set(normTitle(t.title), t.id);
  }
  return { byTitle, error: null };
}

/**
 * @param {object} bundle - loadBundle() result
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateBundle(bundle) {
  const errors = [];
  const warnings = [];

  errors.push(...validateCustomExercises(bundle.customExercises));

  const customByTitle = new Map();
  for (const spec of Object.values(bundle.customExercises ?? {})) {
    customByTitle.set(normTitle(spec.title), true);
  }

  const { byTitle: templatesByTitle, error: cacheError } = loadTemplatesByTitle();
  if (cacheError) {
    errors.push(cacheError);
    return { errors, warnings };
  }

  for (const routine of bundle.routines.data ?? []) {
    for (const ex of routine.exercises ?? []) {
      const tid = ex.exercise_template_id;
      const title = ex.title ?? '';

      if (tid === PLACEHOLDER_TEMPLATE_ID) {
        if (!customByTitle.has(normTitle(title)) && !templatesByTitle.has(normTitle(title))) {
          errors.push(
            `Routine "${routine.title}" / "${title}": placeholder id but no matching custom-exercises.json title or Hevy cache entry`
          );
        }
        continue;
      }

      if (tid && !templatesByTitle.has(normTitle(title))) {
        const mappingRow = (bundle.mapping.mapping ?? []).find(
          (m) => m.hevyId === tid
        );
        if (!mappingRow) {
          warnings.push(
            `Routine "${routine.title}" / "${title}": template id ${tid} not in cache (may still exist on Hevy)`
          );
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * @param {object} bundle - loadBundle() result
 * @throws {Error} If validation fails
 */
export function assertBundleValid(bundle) {
  const { errors, warnings } = validateBundle(bundle);
  for (const w of warnings) console.warn(`Warning: ${w}`);
  if (errors.length > 0) {
    throw new Error(
      `Validation failed (${errors.length} error(s)):\n` + errors.map((e) => `  - ${e}`).join('\n')
    );
  }
}
