# Hevy API Data & Scripts

Data and client for syncing with [Hevy](https://www.hevyapp.com/) via API.

## Data (`data/`)

| File | Source | Description |
|------|--------|-------------|
| `exercise-templates.json` | `npm run hevy:fetch` | Hevy's exercise library (built-in + custom) |
| `routines.json` | `npm run hevy:fetch` | User's routines |
| `routine-folders.json` | `npm run hevy:fetch` | Routine folder structure |
| `exercise-mapping.json` | `npm run hevy:map-exercises` | Repo slug → Hevy template ID mapping |

## Scripts (from repo root)

```bash
npm run hevy:fetch              # Fetch all (templates, routines, folders)
npm run hevy:fetch-exercises    # Fetch exercise templates only
npm run hevy:fetch-routines    # Fetch routines only
npm run hevy:fetch-folders     # Fetch routine folders only
npm run hevy:map-exercises     # Compare repo exercises to Hevy; update mapping + hevy/exercises-to-create.md
```

## Prerequisites

- `HEVY_API_KEY_KHOIPHAN21` or `HEVY_API_KEY` environment variable
- Hevy Pro membership
