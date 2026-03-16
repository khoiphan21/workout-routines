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
├── programs/           # Workout programs by user
│   └── khoiphan21/
│       └── push-pull-homegym/
├── exercises/          # Exercise library (technique, progressions, scaling)
├── plans/              # Implementation plans (e.g., Hevy API integration)
└── .vitepress/         # VitePress config for docs site
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
