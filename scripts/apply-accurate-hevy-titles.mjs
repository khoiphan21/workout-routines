#!/usr/bin/env node
/**
 * Point routine exercises at custom templates (placeholder IDs + exact titles).
 * Run after updating custom-exercises.json: node scripts/apply-accurate-hevy-titles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PLACEHOLDER = '00000000-0000-0000-0000-000000000001';

/** @type {Record<string, { title: string, matchNotes?: RegExp, routineTitle?: RegExp }[]>} */
const ROUTINE_FIXES = {
  'programs/khoiphan21/push-pull-homegym/hevy/routines.json': [
    { title: 'Band Overhead Press', matchNotes: /band overhead press/i },
    { title: 'Bodyweight Split Squat', matchNotes: /split squat pattern/i },
    { title: 'Bar Muscle Up', matchNotes: /strict muscle-up|bar muscle/i },
    {
      title: 'Back Lever Tuck Hold',
      matchNotes: /back lever tuck/i,
    },
  ],
};

/** Replace by exact current title (all routines in file) */
const TITLE_REPLACEMENTS = {
  'programs/khoiphan21/push-pull-homegym/hevy/routines.json': {
    'Shoulder Press (Dumbbell)': { title: 'Band Overhead Press', id: PLACEHOLDER },
    'Muscle Up': { title: 'Bar Muscle Up', id: PLACEHOLDER },
    Lunge: { title: 'Bodyweight Split Squat', id: PLACEHOLDER },
  },
};

function applyFile(relPath, noteFixes, titleFixes) {
  const p = path.join(ROOT, relPath);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;

  for (const routine of doc.data ?? []) {
    for (const ex of routine.exercises ?? []) {
      const tf = titleFixes[ex.title];
      if (tf) {
        ex.title = tf.title;
        ex.exercise_template_id = tf.id;
        n++;
        continue;
      }
      for (const fix of noteFixes) {
        if (fix.routineTitle && !fix.routineTitle.test(routine.title)) continue;
        if (fix.matchNotes && fix.matchNotes.test(ex.notes ?? '')) {
          ex.title = fix.title;
          ex.exercise_template_id = PLACEHOLDER;
          n++;
          break;
        }
      }
    }
  }

  fs.writeFileSync(p, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`${relPath}: ${n} exercise(s) updated`);
}

for (const [rel, fixes] of Object.entries(ROUTINE_FIXES)) {
  applyFile(rel, fixes, TITLE_REPLACEMENTS[rel] ?? {});
}
