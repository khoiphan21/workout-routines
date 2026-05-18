# Hevy API Data & Scripts

Data and client for syncing with [Hevy](https://www.hevyapp.com/) via API.

## Layout

| Path | Role |
|------|------|
| `cache/` | Fetched Hevy library (read-only cache) |
| `account/<user>/exercise-mapping.json` | Merged slug → template ID map after pushes |
| `programs/<user>/<program>/hevy/` | Per-program bundle: `manifest.json`, `routines.json`, `mapping.json`, `custom-exercises.json` |

## Scripts (from repo root)

```bash
npm run hevy:fetch              # Fetch templates, all routines, folders → cache/
npm run hevy:fetch-exercises    # Exercise templates only
npm run hevy:fetch-routines     # All account routines → cache/routines-all.json
npm run hevy:fetch-folders      # Routine folders only
npm run hevy:map -- <program>   # Map manifest slugs → Hevy IDs; writes program hevy/mapping.json + status.md
npm run hevy:push -- <program>  # Create customs + upsert routines for one program
```

Program argument examples: `push-pull-homegym`, `programs/khoiphan21/push-pull-gym-monster-2`.

Flags: `--dry-run`, `--fetch` (refresh template cache before push).

## Prerequisites

- Hevy Pro membership
- API key via **`HEVY_API_KEY_KHOIPHAN21`** in the environment, or in **`.env.local`** (copy from [`.env.example`](../../.env.example); file is gitignored)
- Optional fallbacks: `HEVY_API_KEY`, `HEVY_API_TOKEN`
