# Push–Pull @ World Gym

Commercial-gym variant of [Push–Pull Home Gym](../push-pull-homegym/) for sessions at **World Gym** (or any full cable + bar setup). Same **Pull B** intent as home gym: **muscle-up power first**, then skill work, then cable hypertrophy.

**Home gym full week?** See [Push–Pull Home Gym](../push-pull-homegym/). **GM2-only?** See [Push–Pull Gym Monster 2](../push-pull-gym-monster-2/).

## Equipment (World Gym)

- **Pull-up bar / rig** — muscle-ups, archer pull-ups
- **Rings or bar** — back lever tuck hold (use rings if available; bar tuck is fine)
- **GHD or bench + anchor** — Nordic curl (band-assist as needed)
- **Cable stations** — seated row, crossover rear-delt fly, lat pulldown, cable crunch
- **Optional:** light resistance band for warm-up pull-aparts if you bring one

## Hevy folder

Routines live under **`Push-Pull @ World Gym`** on Hevy (separate from home gym and GM2 folders).

## Power Week — Pull B

Session order: **warm-up → power → skills → cable hypertrophy + abs**. Do not superset the muscle-up.

| Block | Exercise | Prescription |
|-------|----------|--------------|
| Warm-up | Warmup: General - World Gym | 1× **7 min** (420 s) duration — gym cable protocol in routine notes |
| **Power** | **Bar Muscle Up** | **3×3** — first strength slot; warm up with singles or easier variations; **3–4 min** rest |
| Skill pair | Archer Pull-Up ↔ Back Lever Tuck Hold | 3×4/side → 3×12 s; **60–75 s** after the pair |
| Skill | Nordic Hamstrings Curl | 3×6 — own block; **~90 s** if needed |
| Hypertrophy H1–H2 | Seated Cable Row (wide) ↔ Rear Delt Reverse Fly (Cable) | 3×10 → 3×15; **60–75 s** after H2 |
| Hypertrophy H3 | Reverse Grip Lat Pulldown (Cable) | 3×15 — supinated stack vs Pull A pronated work |
| Abs | Cable Crunch | 3×12 |

### vs Home Gym Pull B

| | Home Gym | World Gym |
|---|----------|-----------|
| Power | Muscle-up (bar) | **Same — muscle-up first** |
| Skills | Archer, back lever, Nordic | Same patterns |
| Hypertrophy | GM2 cables | **Commercial cable / lat pulldown stations** |
| Warm-up | Band protocol (home) | **Gym cable + optional band** |

## Global rules (Pull B)

- **Power triples:** ~85–90% of today's best triple; ~1 RIR on the first 2 work sets.
- **Hypertrophy:** RPE 8–9 (1–2 RIR); **60–75 s** between supersetted pairs.
- **Skills / holds:** clean positions with 1–2 s in reserve on timed holds.

## Hevy sync

```bash
npm run hevy:validate -- push-pull-world-gym
npm run hevy:map -- push-pull-world-gym
npm run hevy:push -- push-pull-world-gym --allow-create
```
