# Exercises to Create on Hevy

This document lists exercises from this repo that are **not yet** in Hevy's exercise library. Use this list when creating custom exercise templates on Hevy via the API.

**Generated:** 2026-03-22T22:41:13.799Z

**Summary:**
- Repo exercises: 39
- Matched to Hevy: 34 (includes proxy mappings used for `programs/khoiphan21/push-pull-homegym` → see `libs/hevy/data/exercise-mapping.json`)
- **To create on Hevy:** 5

---

## Exercise Templates to Create

| # | Repo Title | Slug | File |
|---|------------|------|------|
| 1 | Band High-to-Low Row | `band-high-to-low-row` | `exercises/band-high-to-low-row.md` |
| 2 | Dragon Flag Negatives | `dragon-flag-negatives` | `exercises/dragon-flag-negatives.md` |
| 3 | Reverse Fly (band) | `reverse-fly-band` | `exercises/reverse-fly-band.md` |
| 4 | Ring Knee Tucks | `ring-knee-tucks` | `exercises/ring-knee-tucks.md` |
| 5 | Wide-Grip Inverted Row | `wide-grip-inverted-row` | `exercises/wide-grip-inverted-row.md` |

---

## Matched Exercises (for reference)

Full mappings (including Power Week proxy templates) live in `libs/hevy/data/exercise-mapping.json`. Re-run `npm run hevy:map-exercises` after `npm run hevy:fetch` to regenerate this file from fuzzy matching; manual `proxyNote` entries may need to be merged back in.

---

## Next Steps

1. Review the list above.
2. Create custom exercise templates on Hevy for each "To Create" item (via API or Hevy app).
3. Update `libs/hevy/data/exercise-mapping.json` after creating templates to include them in the mapping.
4. Re-run `npm run hevy:map-exercises` after fetching updated templates to refresh the mapping.
