#!/usr/bin/env node
/**
 * Generate programs/khoiphan21/push-pull-gym-monster-2/hevy/routines.json (Power Week, 5 days).
 * Run: node scripts/build-gm2-routines.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preserveRoutineIds } from '../libs/hevy/program-bundle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  '../programs/khoiphan21/push-pull-gym-monster-2/hevy/routines.json'
);

const PLACEHOLDER = '00000000-0000-0000-0000-000000000001';

const T = {
  notes: '2e6c1b67-6b65-4467-a325-7e718fefc65a',
  closeGripBenchSmith: PLACEHOLDER,
  benchSmithPause: PLACEHOLDER,
  seatedChestFlyHold: PLACEHOLDER,
  ohpSmith: 'B09A1304',
  ohpSmithBottomHold: PLACEHOLDER,
  bssCable: PLACEHOLDER,
  chestFlyCable: PLACEHOLDER,
  sissySquatCable: PLACEHOLDER,
  hammerCurl: '36E8F14E',
  crunch: '23A48484',
  chestSupportedRow: PLACEHOLDER,
  straightArmPulldown: 'D2387AB1',
  uprightRow: '286C1D0B',
  saCableRow: 'D0C4A899',
  facePull: 'BE640BA0',
  cableRowBar: 'F1D60854',
  bicepCurl: 'ADA8623C',
  vGripRow: '0393F233',
  splitSquatSmith: PLACEHOLDER,
  stair: '4377A52C',
  rowing: '0222DB42',
  kneeRaise: 'BD5935CF',
  ohpCableGm2: '8917a840-6edb-498e-a59c-bae2b2da5eaa',
  ohpCableGm2TopHold: PLACEHOLDER,
  inclineCableGm2: '0bdabadd-dff1-40a8-8f3e-1f77e80daa10',
  legCurlSeated: '11A123F3',
  lyingLegCurl: 'B8127AD1',
  ohTriExt: 'B5EFBF9C',
  lateralRaise: 'BE289E45',
  calfSmith: 'AA52E8D2',
  rdlSmith: PLACEHOLDER,
  latPdExplosive: PLACEHOLDER,
  latPd: '6A6C31A5',
  saLatPd: '2EE45F81',
  rowWide: 'C3BCABB3',
  rearDeltFly: 'C315DC2A',
  revGripLatPd: '046E25A2',
};

const GM2_WARMUP_NOTES = `Pull–Push Gym Monster 2 — Power Week

All work on GM2 (Smith + cables). Hypertrophy: RPE 8–9 (1–2 RIR). Power triples: ~85–90% of today's triple; 1 RIR on sets 1–2. Do not superset power work.

General warm-up (every day, GM2):
Face Pull (Cable) 1×10; Cable Twist (Up to Down) 1×10/side light; Seated Cable Row – Bar Grip 1×10; Face Pull 1×10 (ER emphasis); OH Triceps Extension (Cable) 1×10/side light; RDL (Smith) 1×10; Cable Row 1×10; Squat (Smith) ×5 → OHP (Smith) ×5 complex.

See programs/khoiphan21/push-pull-gym-monster-2 for tempo/volume weeks and progression.`;

function set(i, type, { reps, duration_seconds } = {}) {
  return {
    index: i,
    type,
    weight_kg: null,
    reps: reps ?? null,
    distance_meters: null,
    duration_seconds: duration_seconds ?? null,
    custom_metric: null,
  };
}

function repsSets(reps, count, type = 'normal') {
  return Array.from({ length: count }, (_, i) => set(i, type, { reps }));
}

function durationSets(sec, count, type = 'normal') {
  return Array.from({ length: count }, (_, i) => set(i, type, { duration_seconds: sec }));
}

function powerSmithRamp(workReps = 3) {
  return [
    set(0, 'warmup', { reps: 10 }),
    set(1, 'warmup', { reps: 3 }),
    set(2, 'warmup', { reps: 2 }),
    set(3, 'normal', { reps: workReps }),
    set(4, 'normal', { reps: workReps }),
    set(5, 'normal', { reps: workReps }),
  ];
}

function powerCableRamp(workReps = 3) {
  return [
    set(0, 'warmup', { reps: 5 }),
    set(1, 'warmup', { reps: 3 }),
    set(2, 'normal', { reps: workReps }),
    set(3, 'normal', { reps: workReps }),
    set(4, 'normal', { reps: workReps }),
  ];
}

function ex(index, title, templateId, opts = {}) {
  const {
    notes = '',
    superset_id = null,
    sets = repsSets(10, 3),
    rest_seconds = 60,
  } = opts;
  return {
    index,
    title,
    notes,
    exercise_template_id: templateId,
    superset_id,
    sets,
    rest_seconds,
  };
}

function routine(title, exercises) {
  return {
    id: null,
    title,
    folder_id: null,
    _folder_name: 'Push-Pull Gym Monster 2',
    notes: '',
    exercises,
  };
}

const day1 = routine('Power Week - Day 1: Push A', [
  ex(0, 'General Notes & Warm-Up', T.notes, {
    notes: GM2_WARMUP_NOTES,
    sets: [set(0, 'normal', { reps: 1 })],
    rest_seconds: 0,
  }),
  ex(1, 'Close-Grip Bench Press (Smith Machine)', T.closeGripBenchSmith, {
    notes:
      'Power: 3×3. Grip ~shoulder width. Ramp: empty bar ×8–10, ~50% ×3, ~70% ×2, work sets. Rest 3–4 min. +2.5 kg after clean 3×3.',
    sets: powerSmithRamp(3),
    rest_seconds: 180,
  }),
  ex(2, 'Seated Chest Fly (Cable) — Bottom Hold', T.seatedChestFlyHold, {
    notes: 'Technical A1: 3×10 s bottom hold (light; squeeze stretch). Then A2 OHP Smith. 60–75 s after A2.',
    superset_id: 0,
    sets: durationSets(10, 3),
    rest_seconds: 0,
  }),
  ex(3, 'Overhead Press (Smith Machine)', T.ohpSmith, {
    notes: 'Technical A2: 3×3. Paired with chest fly hold.',
    superset_id: 0,
    sets: repsSets(3, 3),
    rest_seconds: 75,
  }),
  ex(4, 'Bulgarian Split Squat (Cable, Gym Monster 2)', T.bssCable, {
    notes: 'Hypertrophy H1: 3×8/side (GM2 cable handle). Superset with chest fly.',
    superset_id: 2,
    sets: repsSets(8, 3),
    rest_seconds: 0,
  }),
  ex(5, 'Chest Fly (Cable, Gym Monster 2)', T.chestFlyCable, {
    notes: 'Hypertrophy H2: 3×12 chest fly (GM2). 60–75 s after this exercise.',
    superset_id: 2,
    sets: repsSets(12, 3),
    rest_seconds: 75,
  }),
  ex(6, 'Sissy Squat (Cable, Gym Monster 2)', T.sissySquatCable, {
    notes:
      'Hypertrophy H3: 3×12/side. Low pulley ~1–3, anchored feet, cable handle or belt. Superset with hammer curl.',
    superset_id: 3,
    sets: repsSets(12, 3),
    rest_seconds: 0,
  }),
  ex(7, 'Hammer Curl (Cable)', T.hammerCurl, {
    notes: 'Hypertrophy H4: 3×12. 60–75 s after this exercise.',
    superset_id: 3,
    sets: repsSets(12, 3),
    rest_seconds: 75,
  }),
  ex(8, 'Cable Crunch', T.crunch, {
    notes: 'Abs: 3×15.',
    sets: repsSets(15, 3),
    rest_seconds: 60,
  }),
]);

const day2 = routine('Power Week - Day 2: Pull A', [
  ex(0, 'General Notes & Warm-Up', T.notes, {
    notes: GM2_WARMUP_NOTES,
    sets: [set(0, 'normal', { reps: 1 })],
    rest_seconds: 0,
  }),
  ex(1, 'Chest-Supported Row (Cable, Gym Monster 2)', T.chestSupportedRow, {
    notes:
      'Power: 3×3. Works Plus ~30–45°, mid pulleys on vertical bars ~4–6, cable row bar. Ramp ~50%×5, ~70%×3, work. +2.5 kg after clean 3×3. Rest 3–4 min.',
    sets: powerCableRamp(3),
    rest_seconds: 180,
  }),
  ex(2, 'Straight Arm Lat Pulldown (Cable)', T.straightArmPulldown, {
    notes: 'Technical B1: 3×12 s hold (light only). Pair with upright row.',
    superset_id: 0,
    sets: durationSets(12, 3),
    rest_seconds: 0,
  }),
  ex(3, 'Upright Row (Cable)', T.uprightRow, {
    notes: 'Technical B2: 3×5. 60–75 s after this exercise.',
    superset_id: 0,
    sets: repsSets(5, 3),
    rest_seconds: 75,
  }),
  ex(4, 'Single Arm Cable Row', T.saCableRow, {
    notes: 'Technical B3: 3×5/side seated on bench. Own block — 2–3 min between rounds if needed.',
    sets: repsSets(5, 3),
    rest_seconds: 120,
  }),
  ex(5, 'Face Pull', T.facePull, {
    notes: 'Hypertrophy H1: 3×15. Superset with cable row.',
    superset_id: 2,
    sets: repsSets(15, 3),
    rest_seconds: 0,
  }),
  ex(6, 'Seated Cable Row - Bar Grip', T.cableRowBar, {
    notes: 'Hypertrophy H2: 3×10 squeeze scapulae. 60–75 s after row.',
    superset_id: 2,
    sets: repsSets(10, 3),
    rest_seconds: 75,
  }),
  ex(7, 'Bicep Curl (Cable)', T.bicepCurl, {
    notes: 'Hypertrophy: 3×12 after face pull / row pair.',
    sets: repsSets(12, 3),
    rest_seconds: 75,
  }),
  ex(8, 'Cable Crunch', T.crunch, {
    notes: 'Abs: 3×12.',
    sets: repsSets(12, 3),
    rest_seconds: 60,
  }),
]);

const day3 = routine('Power Week - Day 3: Conditioning', [
  ex(0, 'General Notes & Warm-Up', T.notes, {
    notes: `${GM2_WARMUP_NOTES}\n\nConditioning: RPE ~5–7. Circuit ×3 (giant set); EMOM 12 (odd: stair/row 45 s, even: face pull 15); finisher knee raise + crunch.`,
    sets: [set(0, 'normal', { reps: 1 })],
    rest_seconds: 0,
  }),
  ex(1, 'Seated Cable Row - V Grip (Cable)', T.vGripRow, {
    notes: 'Circuit ×3: 15 reps. Giant set start.',
    superset_id: 0,
    sets: repsSets(15, 3),
    rest_seconds: 0,
  }),
  ex(2, 'Overhead Press (Smith Machine)', T.ohpSmith, {
    notes: 'Circuit: 15 reps light.',
    superset_id: 0,
    sets: repsSets(15, 3),
    rest_seconds: 0,
  }),
  ex(3, 'Split Squat (Smith Machine)', T.splitSquatSmith, {
    notes: 'Circuit: Split squat on Smith — 12/side.',
    superset_id: 0,
    sets: repsSets(12, 3),
    rest_seconds: 0,
  }),
  ex(4, 'Cable Crunch', T.crunch, {
    notes: 'Circuit: 20 controlled reps or slow tempo. 60–90 s after round.',
    superset_id: 0,
    sets: repsSets(20, 3),
    rest_seconds: 90,
  }),
  ex(5, 'Stair Machine (Steps)', T.stair, {
    notes: 'EMOM odd: 45 s (6 sets for 12 min). Alternate with face pull.',
    sets: durationSets(45, 6),
    rest_seconds: 15,
  }),
  ex(6, 'Face Pull', T.facePull, {
    notes: 'EMOM even: 15 reps light (6 sets).',
    sets: repsSets(15, 6),
    rest_seconds: 45,
  }),
  ex(7, 'Lying Knee Raise', T.kneeRaise, {
    notes: 'Finisher C1: accumulate 60 s total (e.g. 4×15 s). Bench + ankle strap on GM2.',
    superset_id: 1,
    sets: durationSets(15, 4),
    rest_seconds: 0,
  }),
  ex(8, 'Cable Crunch', T.crunch, {
    notes: 'Finisher C2: 3×20. 60–75 s after crunches.',
    superset_id: 1,
    sets: repsSets(20, 3),
    rest_seconds: 75,
  }),
]);

const day4 = routine('Power Week - Day 4: Push B', [
  ex(0, 'General Notes & Warm-Up', T.notes, {
    notes: GM2_WARMUP_NOTES,
    sets: [set(0, 'normal', { reps: 1 })],
    rest_seconds: 0,
  }),
  ex(1, 'Bench Press (Smith Machine, 2s Pause)', T.benchSmithPause, {
    notes:
      'Power: 3×3 with 2 s pause on chest. Ramp: empty bar ×8–10, ~50%×3, ~70%×2, ~85%×1, work. Rest 3–4 min.',
    sets: [
      set(0, 'warmup', { reps: 10 }),
      set(1, 'warmup', { reps: 3 }),
      set(2, 'warmup', { reps: 2 }),
      set(3, 'warmup', { reps: 1 }),
      set(4, 'normal', { reps: 3 }),
      set(5, 'normal', { reps: 3 }),
      set(6, 'normal', { reps: 3 }),
    ],
    rest_seconds: 180,
  }),
  ex(2, 'Overhead Press (Smith Machine) — Bottom Hold', T.ohpSmithBottomHold, {
    notes: 'Technical D1: 3×20–30 s bottom-range hold (light).',
    superset_id: 0,
    sets: durationSets(25, 3),
    rest_seconds: 0,
  }),
  ex(3, 'Overhead Press (Smith Machine)', T.ohpSmith, {
    notes: 'Technical D2: 3×3.',
    superset_id: 0,
    sets: repsSets(3, 3),
    rest_seconds: 0,
  }),
  ex(4, 'Overhead Press (Cable, Gym Monster 2) — Top Hold', T.ohpCableGm2TopHold, {
    notes: 'Technical D3: 3×15 s top hold (light). 60–75 s after D3.',
    superset_id: 0,
    sets: durationSets(15, 3),
    rest_seconds: 75,
  }),
  ex(5, 'Overhead Press (Cable, Gym Monster 2)', T.ohpCableGm2, {
    notes: 'Hypertrophy H1: 3×8. Giant with incline.',
    superset_id: 2,
    sets: repsSets(8, 3),
    rest_seconds: 0,
  }),
  ex(6, 'Incline Bench Press (Cable, Gym Monster 2)', T.inclineCableGm2, {
    notes: 'Hypertrophy H2: 3×12. 60–75 s after incline.',
    superset_id: 2,
    sets: repsSets(12, 3),
    rest_seconds: 75,
  }),
  ex(7, 'Seated Leg Curl (Machine)', T.legCurlSeated, {
    notes: 'Hypertrophy H3: 3×12 ankle straps. Pair with OH triceps extension.',
    superset_id: 3,
    sets: repsSets(12, 3),
    rest_seconds: 0,
  }),
  ex(8, 'Overhead Triceps Extension (Cable)', T.ohTriExt, {
    notes: 'Hypertrophy H4: 3×15. 60–75 s after extension.',
    superset_id: 3,
    sets: repsSets(15, 3),
    rest_seconds: 75,
  }),
  ex(9, 'Lateral Raise (Cable)', T.lateralRaise, {
    notes: 'Hypertrophy H5: 3×12. Pair with calf raise.',
    superset_id: 4,
    sets: repsSets(12, 3),
    rest_seconds: 0,
  }),
  ex(10, 'Standing Calf Raise (Smith)', T.calfSmith, {
    notes: 'Hypertrophy H6: 3×12. 60–75 s after calves.',
    superset_id: 4,
    sets: repsSets(12, 3),
    rest_seconds: 75,
  }),
  ex(11, 'Cable Crunch', T.crunch, {
    notes: 'Abs: 3×15.',
    sets: repsSets(15, 3),
    rest_seconds: 60,
  }),
]);

const day5 = routine('Power Week - Day 5: Pull B', [
  ex(0, 'General Notes & Warm-Up', T.notes, {
    notes: GM2_WARMUP_NOTES,
    sets: [set(0, 'normal', { reps: 1 })],
    rest_seconds: 0,
  }),
  ex(1, 'Romanian Deadlift (Smith Machine)', T.rdlSmith, {
    notes:
      'Power: 3×3. Barbell hooks + pad. Ramp empty ×8–10, ~50%×3, ~70%×2, work. +2.5 kg after clean 3×3. Rest 3–4 min.',
    sets: powerSmithRamp(3),
    rest_seconds: 180,
  }),
  ex(2, 'Lat Pulldown (Cable) — Explosive', T.latPdExplosive, {
    notes:
      'Technical E1: 1×5 warmup, then 3×3 explosive concentric (submax load; high pulleys ~7–9).',
    superset_id: 0,
    sets: [set(0, 'warmup', { reps: 5 }), ...repsSets(3, 3)],
    rest_seconds: 0,
  }),
  ex(3, 'Single Arm Lat Pulldown', T.saLatPd, {
    notes: 'Technical E2: 3×4/side. 60–75 s after E2.',
    superset_id: 0,
    sets: repsSets(4, 3),
    rest_seconds: 75,
  }),
  ex(4, 'Straight Arm Lat Pulldown (Cable)', T.straightArmPulldown, {
    notes: 'Technical F1: 3×12 s hold (light).',
    superset_id: 1,
    sets: durationSets(12, 3),
    rest_seconds: 0,
  }),
  ex(5, 'Lying Leg Curl (Machine)', T.lyingLegCurl, {
    notes: 'Technical F2: 3×6, 3 s eccentric on GM2 (ankle straps / bench).',
    superset_id: 1,
    sets: repsSets(6, 3),
    rest_seconds: 75,
  }),
  ex(6, 'Seated Cable Row - Bar Wide Grip', T.rowWide, {
    notes: 'Hypertrophy H1: 3×10. Superset with rear delt fly.',
    superset_id: 2,
    sets: repsSets(10, 3),
    rest_seconds: 0,
  }),
  ex(7, 'Rear Delt Reverse Fly (Cable)', T.rearDeltFly, {
    notes: 'Hypertrophy H2: 3×15. 60–75 s after fly.',
    superset_id: 2,
    sets: repsSets(15, 3),
    rest_seconds: 75,
  }),
  ex(8, 'Reverse Grip Lat Pulldown (Cable)', T.revGripLatPd, {
    notes:
      'Hypertrophy H3: 3×15 submax (kneeling). If load-capped, use supinated chest-supported row. Giant with crunch.',
    superset_id: 3,
    sets: repsSets(15, 3),
    rest_seconds: 0,
  }),
  ex(9, 'Cable Crunch', T.crunch, {
    notes: 'Hypertrophy H4: 3×12. 60–75 s after crunch.',
    superset_id: 3,
    sets: repsSets(12, 3),
    rest_seconds: 75,
  }),
]);

const doc = preserveRoutineIds(
  {
    source: 'programs/khoiphan21/push-pull-gym-monster-2',
    fetchedAt: null,
    count: 5,
    data: [day1, day2, day3, day4, day5],
  },
  OUT
);

fs.writeFileSync(OUT, JSON.stringify(doc, null, 2), 'utf8');
console.log(`Wrote ${OUT} (${doc.count} routines)`);
