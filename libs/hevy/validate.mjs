/**
 * Validate program Hevy bundles before API push.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildTemplateIndexForAccount,
  EXERCISE_TEMPLATES_CACHE,
  loadExerciseTemplates,
  PLACEHOLDER_TEMPLATE_ID,
} from './template-index.mjs';
import { CACHE_DIR, listProgramsForAccount, loadBundle, normTitle } from './program-bundle.mjs';

export { PLACEHOLDER_TEMPLATE_ID };

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

/**
 * @param {string} account
 * @param {object} [opts]
 * @param {object} [opts.templateIndex] - pre-built index
 * @returns {Promise<string[]>} errors
 */
export async function validateAccountTemplates(account, opts = {}) {
  const errors = [];
  let index = opts.templateIndex;

  if (!index) {
    if (!fs.existsSync(EXERCISE_TEMPLATES_CACHE)) {
      errors.push(`Missing ${EXERCISE_TEMPLATES_CACHE}. Run: npm run hevy:fetch-exercises`);
      return errors;
    }
    const { templates } = await loadExerciseTemplates({ requireCache: true });
    index = buildTemplateIndexForAccount(templates, account);
  }

  for (const programDir of listProgramsForAccount(account)) {
    const bundle = loadBundle(programDir);
    for (const spec of Object.values(bundle.customExercises ?? {})) {
      if (!spec?.title) continue;
      const key = normTitle(spec.title);
      if (!index.duplicateTitles.has(key)) continue;
      const preferred = index.canonical?.preferredByTitle?.get(key) ?? index.preferredByTitle.get(key);
      if (!preferred || !index.liveIds.has(preferred)) {
        const count = index.byTitle.get(key)?.length ?? 0;
        errors.push(
          `${bundle.manifest.id}: ${count} Hevy templates titled "${spec.title}". Run: npm run hevy:list-duplicates -- --fetch`
        );
      }
    }
  }

  return errors;
}

/**
 * @param {object} bundle - loadBundle() result
 * @param {object} [opts]
 * @param {object} [opts.templateIndex]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateBundle(bundle, opts = {}) {
  const errors = [];
  const warnings = [];

  errors.push(...validateCustomExercises(bundle.customExercises));

  const customByTitle = new Map();
  for (const [slug, spec] of Object.entries(bundle.customExercises ?? {})) {
    customByTitle.set(normTitle(spec.title), slug);
  }

  const mappingBySlug = new Map((bundle.mapping.mapping ?? []).map((m) => [m.slug, m]));
  const mappedSlugs = new Set(mappingBySlug.keys());

  for (const entry of bundle.mapping.toCreate ?? []) {
    if (mappedSlugs.has(entry.slug) && mappingBySlug.get(entry.slug)?.hevyId) {
      errors.push(
        `mapping.toCreate includes "${entry.slug}" but mapping already has hevyId — re-run hevy:map`
      );
    }
  }

  for (const [slug, spec] of Object.entries(bundle.customExercises ?? {})) {
    const row = mappingBySlug.get(slug);
    if (row?.hevyTitle && normTitle(row.hevyTitle) !== normTitle(spec.title)) {
      errors.push(
        `Slug "${slug}": mapping hevyTitle "${row.hevyTitle}" does not match custom-exercises title "${spec.title}"`
      );
    }
  }

  let index = opts.templateIndex;
  if (!index) {
    const cachePath = path.join(CACHE_DIR, 'exercise-templates.json');
    if (!fs.existsSync(cachePath)) {
      errors.push(`Missing ${cachePath}. Run: npm run hevy:fetch-exercises`);
      return { errors, warnings };
    }
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const templates = raw.data ?? raw;
    index = buildTemplateIndexForAccount(
      Array.isArray(templates) ? templates : [],
      bundle.manifest.account
    );
  }

  for (const [slug, spec] of Object.entries(bundle.customExercises ?? {})) {
    const key = normTitle(spec.title);
    if (index.duplicateTitles.has(key)) {
      const preferred =
        index.canonical?.preferredByTitle?.get(key) ?? index.preferredByTitle.get(key);
      if (!preferred || !index.liveIds.has(preferred)) {
        const count = index.byTitle.get(key)?.length ?? 0;
        errors.push(
          `Duplicate Hevy templates (${count}) for custom title "${spec.title}". Run: npm run hevy:list-duplicates -- --fetch`
        );
      }
    }

    const row = mappingBySlug.get(slug);
    if (row?.hevyId && !index.liveIds.has(row.hevyId)) {
      errors.push(
        `Slug "${slug}": mapping hevyId ${row.hevyId} not in exercise cache. Run: npm run hevy:fetch-exercises`
      );
    }
  }

  for (const routine of bundle.routines.data ?? []) {
    for (const ex of routine.exercises ?? []) {
      const tid = ex.exercise_template_id;
      const title = ex.title ?? '';

      if (tid === PLACEHOLDER_TEMPLATE_ID) {
        if (!customByTitle.has(normTitle(title)) && !index.templatesByTitle.has(normTitle(title))) {
          errors.push(
            `Routine "${routine.title}" / "${title}": placeholder id but no matching custom-exercises.json title or Hevy cache entry`
          );
        }
        continue;
      }

      if (tid && !index.liveIds.has(tid)) {
        const foundRow = (bundle.mapping.mapping ?? []).find((m) => m.hevyId === tid);
        if (!foundRow) {
          warnings.push(
            `Routine "${routine.title}" / "${title}": template id ${tid} not in cache (may still exist on Hevy)`
          );
        } else {
          errors.push(
            `Routine "${routine.title}" / "${title}": template id ${tid} missing from cache — run hevy:fetch-exercises`
          );
        }
      }

      const titleKey = normTitle(title);
      if (tid && index.duplicateTitles.has(titleKey)) {
        const ids = index.byTitle.get(titleKey) ?? [];
        if (ids.some((x) => x.id === tid) && ids.length > 1) {
          const preferred =
            index.canonical?.preferredByTitle?.get(titleKey) ??
            index.preferredByTitle.get(titleKey);
          if (preferred && tid !== preferred) {
            errors.push(
              `Routine "${routine.title}" / "${title}": uses duplicate template id ${tid}; canonical is ${preferred}. Run hevy:list-duplicates`
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * @param {object} bundle - loadBundle() result
 * @param {object} [opts]
 * @throws {Error} If validation fails
 */
export function assertBundleValid(bundle, opts = {}) {
  const { errors, warnings } = validateBundle(bundle, opts);
  for (const w of warnings) console.warn(`Warning: ${w}`);
  if (errors.length > 0) {
    throw new Error(
      `Validation failed (${errors.length} error(s)):\n` + errors.map((e) => `  - ${e}`).join('\n')
    );
  }
}
