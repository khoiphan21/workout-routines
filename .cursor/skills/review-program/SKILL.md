---
name: review-program
description: Research-grounded program redesign for a specified program path, then produce accurate Hevy mappings (prefer new custom exercises over proxy logging), update routines/templates data, and push to Hevy API for khoiphan21 only. Use when the user asks to review, redesign, or sync a workout program to Hevy with research backing.
compatibility: Requires network access for Hevy API. Requires HEVY_API_KEY_KHOIPHAN21 (or HEVY_API_KEY) for push steps. Use npm only for scripts.
---

# Review program → Hevy (khoiphan21)

End-to-end workflow: **read research → redesign program per user → design Hevy artifacts → push**. Scope is **khoiphan21 only** (env `HEVY_API_KEY_KHOIPHAN21`; do not use or reference other accounts).

## 1. Read research (mandatory before redesign)

Read **all** of these so design choices are evidence-informed:

| Path | Role |
|------|------|
| `research/index.md` | Map of topics |
| `research/strength-hypertrophy.md` | Volume, RIR, frequency, overload |
| `research/recovery-adaptation.md` | Rest, deloads, recovery |
| `research/exercise-selection-technique.md` | Order, tempo, ROM, compounds |
| `research/periodization-programming.md` | Periodization, warm-ups, skills |
| `research/population-specific.md` | Level-appropriate prescriptions |

If any file is missing, read what exists and note gaps in the summary.

**Rules:** Prefer meta-analyses / reviews where the repo cites them; tie program changes to concrete implications (sets, rest, progression, exercise order), not generic advice.

## 2. Clarify scope of the “specified program”

From the user message, identify:

- **Program root**: e.g. `programs/khoiphan21/push-pull-homegym/` (main doc is `index.md` unless they name another file).
- **User instructions**: constraints (equipment, days, goals, injuries, time), and what must stay vs change.

For **calisthenics station + Gym Monster 2** (no commercial gym), avoid dedicated-machine prescriptions (leg extension, seated leg curl, iso-lateral plate rows, standing calf machine, etc.); use bar/rings/bench/bands plus GM2 cables and bodyweight patterns. When Hevy lacks an exact cable variant, add a **custom template** with an explicit title (e.g. “Overhead Press (Cable, Gym Monster 2)”) in `TO_CREATE_SPECS` / `ADDITIONAL_PUSH_SLUGS`.

Re-read that program’s `index.md` (and linked exercise pages under `exercises/` as needed) **after** research so edits align with both science and user intent.

## 3. Redesign the program (documentation)

- Update the program markdown (usually `programs/.../index.md`) with clear structure: days, exercises, sets/reps/tempo/holds, progression, deloads, supersets, equipment notes.
- Keep **single fixed prescriptions** where that is the project style; state assumptions explicitly.
- If you add or rename exercises, add or update `exercises/<slug>.md` so the repo remains the source of truth for technique, progressions, and scaling.

Do **not** invent studies; only claim what the repo’s research files support.

## 4. Design Hevy artifacts (mapping philosophy)

**Default: create custom Hevy exercise templates for movements that are not a true semantic match** to an existing template. “Close enough for logging” proxies (e.g. logging a distinct skill on a generic move) are **discouraged** unless the user explicitly approves a proxy.

For **each** exercise used in the program:

1. **Match** against `libs/hevy/data/exercise-templates.json` (after a fresh fetch—see step 6) only when the Hevy title and movement pattern are the **same** exercise (same pattern, same implement, same intent).
2. If no true match: plan a **new custom template** with:
   - **Title** that matches how the athlete thinks about the move (consistent with `exercises/*.md` H1).
   - **`exercise_type`**: one of `weight_reps` \| `reps_only` \| `bodyweight_reps` \| `bodyweight_assisted_reps` \| `duration` \| `weight_duration` \| `distance_duration` \| `short_distance_weight` (Hevy API).
   - **`equipment_category`**: `none` \| `barbell` \| `dumbbell` \| `kettlebell` \| `machine` \| `plate` \| `resistance_band` \| `suspension` \| `other`.
   - **`muscle_group`** + **`other_muscles`**: best-effort from exercise doc; prefer primary driver.

**Accuracy / detail:**

- Routine **per-exercise notes** in `routines.json` should carry prescription + key cues (from exercise md), not vague text.
- Repo **exercise markdown** remains canonical for long-form technique; Hevy notes are concise but precise (prescription, progression hook, safety).

**Data files to maintain:**

| Artifact | Purpose |
|----------|---------|
| `libs/hevy/data/routines.json` | Full routine payloads (Power/Tempo/Volume as user directs); preserve existing `id` values when updating the same logical routine; use `id: null` only for new routines. |
| `libs/hevy/data/exercise-mapping.json` | Every repo exercise slug → `hevyId`; **remove `proxyNote` rows** when replaced by a real custom template; `toCreate` lists slugs pending custom creation on Hevy. |
| `scripts/hevy-push-program.mjs` | For **each** new custom exercise slug, add a `TO_CREATE_SPECS[<slug>]` entry matching the API shape (`title`, `exerciseType`, `equipmentCategory`, `muscleGroup`, `otherMuscles`). Without this, push will skip creation. |
| `hevy/exercises-to-create.md` | Regenerate or align with mapping after edits (or run `npm run hevy:map-exercises` after fetch, then re-apply manual “custom first” decisions if the script reintroduces fuzzy proxies). |

## 5. Pre-push checklist (design quality)

- [ ] Program doc updated; exercise pages updated for any new/changed moves.
- [ ] Research-informed rationale briefly noted where prescriptions changed (in program doc or PR description).
- [ ] `exercise-mapping.json`: no unnecessary proxies; `toCreate` matches new customs not yet on Hevy.
- [ ] `TO_CREATE_SPECS` in `hevy-push-program.mjs` covers every `toCreate` slug.
- [ ] `routines.json`: every `exercise_template_id` is either a verified existing template or a slug slated for creation in the same change (create templates **before** or in the same push ordering as routines—**push script creates exercises first, then routines**).

## 6. Commands (npm only)

Run from repo root:

```bash
npm run hevy:fetch-exercises   # refresh exercise-templates.json before matching
# optional: npm run hevy:fetch-routines  # if reconciling IDs/titles with Hevy
npm run hevy:map-exercises    # optional: baseline mapping from repo; then override with custom-first rules
npm run docs:build            # must pass before finishing
npm run hevy:push             # uses HEVY_API_KEY_KHOIPHAN21 or HEVY_API_KEY; khoiphan21 account only
```

After a successful `hevy:push`, confirm local `routines.json` and `exercise-mapping.json` were updated by the script (new routine IDs, `toCreate` cleared).

## 7. Git and safety

- Work on the branch the user specifies; commit in small logical chunks; push when asked.
- **Never** push Hevy changes for accounts other than khoiphan21.
- Do not commit API keys. Redact keys from logs and screenshots.

## 8. When the user did not give explicit redesign instructions

Ask concisely for: goals, schedule, equipment, injuries/limitations, and whether to preserve lift variants (e.g. cable vs barbell). If they want defaults, state assumptions and proceed.
