#!/usr/bin/env node
/**
 * Map repo exercises to Hevy templates for a program bundle.
 *
 * Usage:
 *   npm run hevy:map -- push-pull-homegym
 *   npm run hevy:map -- push-pull-gym-monster-2
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE_DIR,
  filterMappingBySlugs,
  getBundlePaths,
  loadAccountMapping,
  loadManifest,
  resolveProgramDir,
} from '../libs/hevy/program-bundle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXERCISES_DIR = path.join(ROOT, 'exercises');
const EXCLUDE_FILES = new Set(['index.md', 'general-notes-and-warm-up.md']);

function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('-'));
  return { programArg: positional[0] };
}

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

function getRepoExercise(slug) {
  const filepath = path.join(EXERCISES_DIR, `${slug}.md`);
  if (!fs.existsSync(filepath)) {
    return { slug, title: slugToTitle(slug), filepath: null };
  }
  const content = fs.readFileSync(filepath, 'utf8');
  const m = content.match(/^#\s+(.+)$/m);
  const title = m ? m[1].trim() : slugToTitle(slug);
  return { slug, title, filepath: `exercises/${slug}.md` };
}

function getHevyTemplates() {
  const filepath = path.join(CACHE_DIR, 'exercise-templates.json');
  if (!fs.existsSync(filepath)) {
    throw new Error(`Missing ${filepath}. Run: npm run hevy:fetch-exercises`);
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

function writeStatusMd(statusPath, manifest, repoExercises, mapping, toCreate) {
  const md = `# Hevy sync status — ${manifest.id}

**Generated:** ${new Date().toISOString()}

| Metric | Count |
|--------|------:|
| Program exercise slugs | ${manifest.exerciseSlugs.length} |
| Matched to Hevy | ${mapping.length} |
| To create on Hevy | ${toCreate.length} |

## Exercises to create

${toCreate.length === 0 ? '_None — all slugs matched or listed in `custom-exercises.json`._' : ''}

| Repo title | Slug | File |
|------------|------|------|
${toCreate.map((e) => `| ${e.title} | \`${e.slug}\` | \`${e.file ?? '—'}\` |`).join('\n')}

## Matched

| Repo title | Hevy title | Hevy ID | Score |
|------------|------------|---------|------:|
${mapping.map((m) => `| ${m.repoTitle} | ${m.hevyTitle} | ${m.hevyId} | ${((m.matchScore ?? 1) * 100).toFixed(0)}% |`).join('\n')}

## Push

\`\`\`bash
npm run hevy:push -- ${manifest.id}
\`\`\`
`;
  fs.writeFileSync(statusPath, md, 'utf8');
}

function main() {
  const { programArg } = parseArgs(process.argv.slice(2));
  const programDir = resolveProgramDir(programArg);
  const manifest = loadManifest(programDir);
  const paths = getBundlePaths(programDir);
  const hevyTemplates = getHevyTemplates();

  const slugs = manifest.exerciseSlugs ?? [];
  const account = loadAccountMapping(manifest.account);
  const accountBySlug = new Map((account?.mapping ?? []).map((m) => [m.slug, m]));
  const mapping = [];
  const toCreate = [];

  for (const slug of slugs) {
    const existing = accountBySlug.get(slug);
    if (existing?.hevyId) {
      mapping.push({ ...existing });
      continue;
    }

    const ex = getRepoExercise(slug);
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
        file: ex.filepath,
      });
    }
  }

  const doc = filterMappingBySlugs(
    { mapping, toCreate, generatedAt: new Date().toISOString() },
    slugs
  );
  doc.generatedAt = new Date().toISOString();

  fs.writeFileSync(paths.mapping, JSON.stringify(doc, null, 2), 'utf8');
  writeStatusMd(paths.status, manifest, slugs, mapping, toCreate);

  console.log(`Wrote ${paths.mapping}`);
  console.log(`Wrote ${paths.status}`);
  console.log(`Matched: ${mapping.length}, To create: ${toCreate.length}`);
}

main();
