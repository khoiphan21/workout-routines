# Workout Programs & Exercises

This repository builds **exercise programs** and a **collection of exercises + image assets** to create programs for any user with a Hevy API key.

## Purpose

- **Programs:** Structured workout programs (e.g., 5-day splits) defined in Markdown, ready to be published to Hevy.
- **Exercises:** A curated library of exercises with technique notes, progressions, and scaling options.
- **Assets:** Image assets to support exercise documentation and Hevy integration.
- **Hevy integration:** Programs and exercises can be pushed to [Hevy](https://www.hevyapp.com/) via the [Hevy API](https://api.hevyapp.com/docs/) for users who have API access (Hevy Pro).

## Current setup

- **User:** khoiphan21 (primary account for publishing)
- **API key:** Stored in `HEVY_API_KEY_KHOIPHAN21` environment variable
- **Programs:** [Push–Pull Home Gym](/programs/khoiphan21/push-pull-homegym), [Push–Pull Gym Monster 2](/programs/khoiphan21/push-pull-gym-monster-2)

## Structure

```
├── programs/<user>/<program>/
│   ├── index.md        # Program prescription (human-readable)
│   └── hevy/           # Hevy sync bundle (routines, mapping, customs)
├── exercises/          # Shared exercise library (technique, progressions)
├── equipment/
├── research/
├── libs/hevy/          # API client, cache, account mapping
└── .vitepress/
```

## Hevy sync

1. Copy `.env.example` → `.env.local` and set `HEVY_API_KEY_KHOIPHAN21` (or export the variable in your shell).

### Safe workflow (recommended)

Run these steps **in order** before pushing a program to Hevy. Replace `<program>` with a slug such as `push-pull-homegym` or `push-pull-gym-monster-2`.

```bash
npm run hevy:fetch-exercises
npm run hevy:map -- <program>
npm run hevy:validate -- <program>
npm run hevy:list-duplicates -- --fetch
npm run hevy:push -- <program>
```

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `hevy:fetch-exercises` | Refresh `libs/hevy/cache/exercise-templates.json` from the API |
| 2 | `hevy:map -- <program>` | Update `programs/.../hevy/mapping.json` and `status.md` (optional: `--fetch`) |
| 3 | `hevy:validate -- <program>` | Fail locally on bad enums, duplicate titles, mapping mismatches |
| 4 | `hevy:list-duplicates -- --fetch` | List duplicate custom exercise IDs to delete in the Hevy app (must be clean) |
| 5 | `hevy:push -- <program>` | Upsert customs and routines (see flags below) |

**Push all khoiphan21 programs** (validate + push + cache refresh, as in CI):

```bash
npm run hevy:sync-khoiphan21
```

### How push avoids duplicates

- Custom exercises resolve by **program/account `hevyId` in mapping first**, then a unique title match in the cache—not by blind POST when the cache is stale.
- New customs are created only for slugs in `mapping.toCreate`, unless you pass `--allow-create`.
- Routine push **adopts by title** or updates an existing id; it **errors** instead of creating a second routine when a same-title routine already exists in the folder.

### Useful push flags

| Flag | When to use |
|------|-------------|
| `--dry-run` | Preview without API writes |
| `--allow-create` | Allow creating any unresolved custom (default: only `mapping.toCreate`) |
| `--fetch` | Refresh exercise cache immediately before this push |
| `--no-fetch` | Use on-disk cache only (errors if missing) |
| `--recreate-routines --i-know-recreate` | After deleting all routines on Hevy; re-adopt by title |

See [AGENTS.md](AGENTS.md) for the full command reference.

### Troubleshooting

- **Duplicate custom exercises on Hevy:** run `hevy:list-duplicates -- --fetch`, delete listed IDs in the app, then re-run the safe workflow.
- **Orphan routines in a folder:** `npm run hevy:list-folder -- <program>` — remove extras in Hevy before pushing again.
- **Regenerating `routines.json`:** use `preserveRoutineIds()` (see `scripts/build-gm2-routines.mjs`) so local routine ids are not wiped.
- **Renamed custom in `custom-exercises.json`:** re-map, validate, delete the old template in Hevy manually; push will not add a second template without `--allow-create`.

## Documentation site

This repo is a VitePress static documentation site. Run:

- `npm run docs:dev` — dev server (port 5173)
- `npm run docs:build` — production build
- `npm run docs:preview` — preview built site

## Adding new users

To support additional users with their own Hevy API keys:

1. Add an environment variable (e.g. `HEVY_API_KEY_<username>`).
2. Create a folder under `programs/<username>/` for their programs.
3. Update scripts/tooling to use the appropriate key per user.
