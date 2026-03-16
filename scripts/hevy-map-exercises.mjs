#!/usr/bin/env node
/**
 * Compare repo exercises to Hevy exercise templates.
 * - Links repo exercises to Hevy templates where names match (fuzzy).
 * - Produces a list of exercises to create on Hevy (not yet in Hevy library).
 * - Writes libs/hevy/data/exercise-mapping.json and hevy/exercises-to-create.md for VitePress.
 *
 * Run after: npm run hevy:fetch (to populate exercise-templates.json)
 *
 * Usage: node scripts/hevy-map-exercises.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXERCISES_DIR = path.join(ROOT, 'exercises');
const DATA_DIR = path.join(ROOT, 'libs/hevy/data');
const HEVY_DOCS_DIR = path.join(ROOT, 'hevy');

const EXCLUDE_FILES = new Set(['index.md', 'general-notes-and-warm-up.md']);

function slugToTitle(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function normalizeForMatch(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

function similarity(a, b) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return matches / longer.length;
}

function getRepoExercises() {
  const files = fs.readdirSync(EXERCISES_DIR);
  const exercises = [];
  for (const f of files) {
    if (!f.endsWith('.md') || EXCLUDE_FILES.has(f)) continue;
    const slug = f.replace(/\.md$/, '');
    const filepath = path.join(EXERCISES_DIR, f);
    const content = fs.readFileSync(filepath, 'utf8');
    const m = content.match(/^#\s+(.+)$/m);
    const title = m ? m[1].trim() : slugToTitle(slug);
    exercises.push({ slug, title, filepath });
  }
  return exercises;
}

function getHevyTemplates() {
  const filepath = path.join(DATA_DIR, 'exercise-templates.json');
  if (!fs.existsSync(filepath)) {
    throw new Error(
      `Missing ${filepath}. Run: npm run hevy:fetch`
    );
  }
  const raw = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const arr = raw.data ?? raw.items ?? raw;
  return Array.isArray(arr) ? arr : [];
}

function findBestMatch(repoTitle, hevyTemplates) {
  let best = null;
  let bestScore = 0;
  for (const t of hevyTemplates) {
    const hevyTitle = t.title ?? t.name ?? t.exercise_name ?? '';
    const score = similarity(repoTitle, hevyTitle);
    if (score > bestScore && score >= 0.95) {
      bestScore = score;
      best = t;
    }
  }
  return best ? { template: best, score: bestScore } : null;
}

function main() {
  const repoExercises = getRepoExercises();
  const hevyTemplates = getHevyTemplates();

  const mapping = [];
  const toCreate = [];

  for (const ex of repoExercises) {
    const match = findBestMatch(ex.title, hevyTemplates);
    if (match) {
      mapping.push({
        slug: ex.slug,
        repoTitle: ex.title,
        hevyId: match.template.id ?? match.template.exercise_template_id,
        hevyTitle: match.template.title ?? match.template.name,
        matchScore: match.score,
      });
    } else {
      toCreate.push({
        slug: ex.slug,
        title: ex.title,
        file: `exercises/${ex.slug}.md`,
      });
    }
  }

  // Write mapping JSON
  const mappingPath = path.join(DATA_DIR, 'exercise-mapping.json');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    mappingPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        hevyTemplateCount: hevyTemplates.length,
        repoExerciseCount: repoExercises.length,
        matched: mapping.length,
        toCreate: toCreate.length,
        mapping,
        toCreate,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`Wrote ${mappingPath}`);

  // Write VitePress doc for review
  fs.mkdirSync(HEVY_DOCS_DIR, { recursive: true });
  const mdPath = path.join(HEVY_DOCS_DIR, 'exercises-to-create.md');
  const md = `# Exercises to Create on Hevy

This document lists exercises from this repo that are **not yet** in Hevy's exercise library. Use this list when creating custom exercise templates on Hevy via the API.

**Generated:** ${new Date().toISOString()}

**Summary:**
- Repo exercises: ${repoExercises.length}
- Matched to Hevy: ${mapping.length}
- **To create on Hevy:** ${toCreate.length}

---

## Exercise Templates to Create

| # | Repo Title | Slug | File |
|---|------------|------|------|
${toCreate.map((e, i) => `| ${i + 1} | ${e.title} | \`${e.slug}\` | \`${e.file}\` |`).join('\n')}

---

## Matched Exercises (for reference)

These repo exercises were matched to existing Hevy templates:

| Repo Title | Hevy Title | Hevy ID | Match Score |
|------------|------------|---------|-------------|
${mapping.map((m) => `| ${m.repoTitle} | ${m.hevyTitle} | ${m.hevyId} | ${(m.matchScore * 100).toFixed(0)}% |`).join('\n')}

---

## Next Steps

1. Review the list above.
2. Create custom exercise templates on Hevy for each "To Create" item (via API or Hevy app).
3. Update \`libs/hevy/data/exercise-mapping.json\` after creating templates to include them in the mapping.
4. Re-run \`npm run hevy:map-exercises\` after fetching updated templates to refresh the mapping.
`;
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`Wrote ${mdPath}`);

  console.log(`\nMatched: ${mapping.length}, To create: ${toCreate.length}`);
}

main();
