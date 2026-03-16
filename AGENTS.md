# AGENTS.md

## Cursor Cloud specific instructions

This is a VitePress static documentation site for a workout program. There is one service: the VitePress dev server.

## Hevy API

- **API docs:** https://api.hevyapp.com/docs/
- **Environment variable:** `HEVY_API_KEY_KHOIPHAN21` — contains the API key to access the khoiphan21 Hevy account for publishing exercises and workouts. Use this when running scripts or automation that push content to Hevy.

- **Dev server:** `npm run docs:dev` (port 5173 by default). Supports hot-reload for `.md` and `.mts` config changes.
- **Build:** `npm run docs:build` — outputs to `.vitepress/dist`.
- **Preview built site:** `npm run docs:preview` — serves the production build locally.
- There are no lint, test, or CI commands beyond the build. The only automated check is that `npm run docs:build` succeeds.
- The VitePress config at `.vitepress/config.mts` auto-generates sidebar navigation from all `.md` files in the repo (excluding `node_modules`, `.git`, `.github`, `.cursor`, `dist`).
- `index.md` is a symlink to `README.md` — this is required for the VitePress dev server to serve the homepage at `/`.
