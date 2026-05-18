# AGENTS.md

## Cursor Cloud specific instructions

This is a VitePress static documentation site for a workout program. There is one service: the VitePress dev server.

## Hevy API

- **API docs:** https://api.hevyapp.com/docs/
- **API key:** Set `HEVY_API_KEY_KHOIPHAN21` in the environment, or copy [`.env.example`](.env.example) to `.env.local` (gitignored) and add your key there. Scripts load `.env.local` automatically when the env var is unset.

- **Dev server:** `npm run docs:dev` (port 5173 by default). Supports hot-reload for `.md` and `.mts` config changes.
- **Push to Hevy:** `npm run hevy:push -- <program>` — program path required (e.g. `push-pull-homegym`). Reads `programs/<user>/<program>/hevy/` (`manifest.json`, `routines.json`, `mapping.json`, `custom-exercises.json`). Validates bundle, reconciles routine IDs with Hevy, then upserts. Requires `HEVY_API_KEY_KHOIPHAN21` or `HEVY_API_KEY`.
- **Validate bundle:** `npm run hevy:validate -- <program>` — checks `custom-exercises.json` enums and routine placeholder resolution (no API calls except cache read).
- **Map exercises:** `npm run hevy:map -- <program>` — updates program `hevy/mapping.json` and `hevy/status.md` from cache. Custom-exercise slugs use exact Hevy title match only (no fuzzy overwrite).
- **Push flags:** `--dry-run` (no writes), `--fetch` (refresh exercise template cache), `--recreate-routines` (clear local routine ids then reconcile — use after deleting all routines on Hevy), `--skip-reconcile` (skip Hevy folder/id sync).
- **List folder routines:** `npm run hevy:list-folder -- <program>` — shows routines in the program folder; marks KEEP vs DELETE for orphan cleanup (Hevy has no DELETE routine API).
- **Troubleshooting duplicates:** Regenerating `routines.json` without preserving ids causes duplicate creates. Use `preserveRoutineIds()` when generating, or `hevy:list-folder` to find orphans. After deleting routines on Hevy, run `npm run hevy:push -- <program> --recreate-routines` (or clear stale ids manually).
- **Invalid muscleGroup:** Use Hevy enums (`lats`, `upper_back`, not `back`). Validation fails locally before push.
- **Hevy cache:** `libs/hevy/cache/` (fetched templates). **Account mapping:** `libs/hevy/account/khoiphan21/exercise-mapping.json`.
- **Build:** `npm run docs:build` — outputs to `.vitepress/dist`.
- **Preview built site:** `npm run docs:preview` — serves the production build locally.
- There are no lint, test, or CI commands beyond the build. The only automated check is that `npm run docs:build` succeeds.
- The VitePress config at `.vitepress/config.mts` auto-generates sidebar navigation from all `.md` files in the repo (excluding `node_modules`, `.git`, `.github`, `.cursor`, `dist`).
- `index.md` is a symlink to `README.md` — this is required for the VitePress dev server to serve the homepage at `/`.
