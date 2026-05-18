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
- **Programs:** See [Push–Pull Home Gym](/programs/khoiphan21/push-pull-homegym) — a 5-day Push–Pull program for home gym (to be updated later)

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
2. Run:

```bash
npm run hevy:fetch-exercises
npm run hevy:map -- push-pull-homegym
npm run hevy:push -- push-pull-homegym
```

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
