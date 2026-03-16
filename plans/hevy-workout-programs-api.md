# Plan: Create Workout Programs & Exercises on Hevy via API

This plan outlines how to publish workout programs and exercises from this repo to [Hevy](https://www.hevyapp.com/) using the [Hevy API](https://api.hevyapp.com/docs/).

## Prerequisites

- **Hevy Pro membership** — required for API access
- **API key** — from [Hevy Developer Settings](https://hevy.com/settings?developer)
- **Environment variable:** `HEVY_API_KEY_KHOIPHAN21` (or `HEVY_API_KEY` / `HEVY_API_TOKEN` for generic tooling)

## Hevy API Overview

| Resource | Purpose |
|----------|---------|
| **Exercise templates** | Reusable exercise definitions (name, muscle targets, equipment, type) |
| **Routines** | Workout templates with exercises, sets, reps, rest, supersets |
| **Workouts** | Completed workout instances (log of what was done) |
| **Routine folders** | Organize routines (e.g. by program) |

### Key endpoints (from API docs)

- Create/update routines
- Create/update exercise templates
- List existing exercises (to match or avoid duplicates)
- Manage routine folders

## Implementation Phases

### Phase 1: API exploration & auth

1. **Explore the API**
   - Read [Hevy API docs](https://api.hevyapp.com/docs/)
   - Identify endpoints for: list exercises, create exercise, create routine, list routines
   - Note auth format (e.g. `Authorization: Bearer <key>` or header name)

2. **Verify auth**
   - Write a minimal script (Node.js or Python) that:
     - Loads `HEVY_API_KEY_KHOIPHAN21`
     - Calls a simple endpoint (e.g. list workouts or routines)
     - Confirms 200 response

3. **Choose tooling**
   - **Option A:** Node.js/TypeScript — fits VitePress ecosystem
   - **Option B:** Python + `hevy-api-wrapper` — [PyPI](https://pypi.org/project/hevy-api-wrapper/), supports routines, exercise templates, workouts
   - **Option C:** Direct REST (curl/fetch) — no extra deps

### Phase 2: Exercise mapping

1. **List Hevy’s built-in exercises**
   - Call API to fetch exercise library
   - Build a mapping: our exercise names (e.g. `Weighted Pull-Up`) → Hevy `exerciseTemplateId`

2. **Handle custom exercises**
   - For exercises not in Hevy’s library:
     - Create custom exercise templates via API
     - Store returned IDs for reuse
   - Consider a local cache file: `exercises/hevy-ids.json` mapping slug → `exerciseTemplateId`

3. **Exercise metadata alignment**
   - Our format: `exercises/<slug>.md` (technique, progressions, scaling)
   - Hevy format: name, primary/secondary muscles, equipment, type (rep vs duration)
   - Define a mapping or schema to convert our data → Hevy exercise template

### Phase 3: Program → routine conversion

1. **Parse program structure**
   - Read `programs/khoiphan21/push-pull-homegym/README.md` (or structured JSON/YAML)
   - Extract: days, exercises per day, sets/reps, supersets, rest times

2. **Map to Hevy routine format**
   - Each day → one routine (or one routine with multiple “sessions” if Hevy supports it)
   - Each exercise block → exercise + sets
   - Supersets → use `supersetId` to group exercises
   - Rest times → `restSeconds` per exercise

3. **Routine structure (Hevy)**
   ```json
   {
     "title": "Push A - Push-Pull Home Gym",
     "exercises": [
       {
         "exerciseTemplateId": "<id>",
         "sets": [
           { "type": "normal", "reps": 3, "weight": null },
           { "type": "normal", "reps": 3, "weight": null },
           { "type": "normal", "reps": 3, "weight": null }
         ],
         "restSeconds": 180,
         "supersetId": null,
         "notes": "Rest 3-4 min."
       }
     ],
     "notes": "Power Week - Day 1"
   }
   ```

### Phase 4: Publish script

1. **CLI or npm script**
   - `npm run hevy:push` or `./scripts/push-to-hevy.js`
   - Input: program path (e.g. `programs/khoiphan21/push-pull-homegym`)
   - Steps:
     1. Parse program
     2. Resolve all exercise IDs (from cache or create custom)
     3. Create/update routines per day
     4. Optionally create a routine folder for the program

2. **Idempotency**
   - Store routine IDs after creation
   - On re-run: update existing routines instead of duplicating

3. **Dry-run mode**
   - `--dry-run` to print what would be created without calling API

### Phase 5: Image assets (optional)

1. **Exercise images**
   - Hevy supports images for custom exercises
   - Add `assets/exercises/<slug>.png` (or similar)
   - Include image URL/path when creating exercise templates

2. **Form videos**
   - Hevy allows links (e.g. form videos) on exercises
   - Map our exercise notes/links → Hevy exercise notes

## Data flow summary

```
exercises/*.md          →  Hevy exercise templates (match or create)
programs/.../README.md  →  Hevy routines (create/update)
assets/                 →  Exercise images (optional)
```

## Suggested file structure for tooling

```
scripts/
  push-to-hevy.js       # or .ts / .py
  lib/
    hevy-client.js      # API client
    parse-program.js    # Parse program markdown
    exercise-mapping.js # Resolve exercise IDs
exercises/
  hevy-ids.json         # Cache: slug → exerciseTemplateId (gitignored or committed)
```

## Risks & mitigations

| Risk | Mitigation |
|------|-------------|
| API changes | Pin to known API version; add integration tests |
| Rate limits | Add retries with backoff; batch where possible |
| Name mismatches | Manual mapping file for ambiguous exercises |
| Duplicate routines | Use idempotency; store routine IDs; update instead of create |

## Next steps

1. [ ] Open Hevy API docs and document exact endpoints + request/response shapes
2. [ ] Implement Phase 1 (auth + simple list call)
3. [ ] Implement Phase 2 (exercise mapping + cache)
4. [ ] Implement Phase 3 (program parser → Hevy routine format)
5. [ ] Implement Phase 4 (push script with dry-run)
6. [ ] Test with `programs/khoiphan21/push-pull-homegym`
