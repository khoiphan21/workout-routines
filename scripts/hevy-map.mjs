#!/usr/bin/env node
/**
 * Map repo exercises to Hevy templates for a program bundle.
 *
 * Custom exercises: canonical resolution via template-index (no guess on duplicates).
 * Other slugs: account mapping, then fuzzy match (score >= 0.98).
 *
 * Usage:
 *   npm run hevy:map -- push-pull-homegym
 *   npm run hevy:map -- push-pull-gym-monster-2 --fetch
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHevyApiKey } from '../libs/hevy/hevy-client.mjs';
import {
  filterMappingBySlugs,
  getBundlePaths,
  loadAccountMapping,
  loadManifest,
  normTitle,
  resolveProgramDir,
} from '../libs/hevy/program-bundle.mjs';
import {
  buildTemplateIndexForAccount,
  loadExerciseTemplates,
  resolveCustomExercise,
} from '../libs/hevy/template-index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXERCISES_DIR = path.join(ROOT, 'exercises');

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('-')));
  const positional = argv.filter((a) => !a.startsWith('-'));
  return { programArg: positional[0], fetch: flags.has('--fetch') };
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

function findBestMatch(repoTitle, hevyTemplates, minScore = 0.98) {
  let best = null;
  let bestScore = 0;
  for (const t of hevyTemplates) {
    const hevyTitle = t.title ?? t.name ?? t.exercise_name ?? '';
    const score = similarity(repoTitle, hevyTitle);
    if (score > bestScore && score >= minScore) {
      bestScore = score;
      best = t;
    }
  }
  return best ? { template: best, score: bestScore } : null;
}

function writeStatusMd(statusPath, manifest, mapping, toCreate, mapErrors) {
  const md = `# Hevy sync status — ${manifest.id}

**Generated:** ${new Date().toISOString()}

| Metric | Count |
|--------|------:|
| Program exercise slugs | ${manifest.exerciseSlugs.length} |
| Matched to Hevy | ${mapping.length} |
| To create on Hevy | ${toCreate.length} |
| Map errors | ${mapErrors.length} |

${
  mapErrors.length
    ? `## Errors

${mapErrors.map((e) => `- ${e}`).join('\n')}

`
    : ''
}## Exercises to create

${toCreate.length === 0 ? '_None — all slugs matched or listed in `custom-exercises.json`._' : ''}

| Repo title | Slug | File | Note |
|------------|------|------|------|
${toCreate.map((e) => `| ${e.title} | \`${e.slug}\` | \`${e.file ?? '—'}\` | ${e.note ?? ''} |`).join('\n')}

## Matched

| Repo title | Hevy title | Hevy ID | Score |
|------------|------------|---------|------:|
${mapping.map((m) => `| ${m.repoTitle} | ${m.hevyTitle} | ${m.hevyId} | ${((m.matchScore ?? 1) * 100).toFixed(0)}% |`).join('\n')}

## Push

\`\`\`bash
npm run hevy:fetch-exercises
npm run hevy:validate -- ${manifest.id}
npm run hevy:list-duplicates -- --fetch
npm run hevy:push -- ${manifest.id} --allow-create
\`\`\`
`;
  fs.writeFileSync(statusPath, md, 'utf8');
}

async function main() {
  const { programArg, fetch } = parseArgs(process.argv.slice(2));
  const programDir = resolveProgramDir(programArg);
  const manifest = loadManifest(programDir);
  const paths = getBundlePaths(programDir);

  if (fetch) getHevyApiKey();
  const { templates } = await loadExerciseTemplates({
    fetch,
    writeCache: fetch,
    requireCache: !fetch,
  });

  const index = buildTemplateIndexForAccount(templates, manifest.account);
  const hevyTemplates = index.templates;

  const customExercises = fs.existsSync(paths.customExercises)
    ? JSON.parse(fs.readFileSync(paths.customExercises, 'utf8'))
    : {};

  const programMapping = fs.existsSync(paths.mapping)
    ? JSON.parse(fs.readFileSync(paths.mapping, 'utf8'))
    : { mapping: [] };

  const slugs = manifest.exerciseSlugs ?? [];
  const account = loadAccountMapping(manifest.account);
  const accountBySlug = new Map((account?.mapping ?? []).map((m) => [m.slug, m]));
  const programBySlug = new Map((programMapping.mapping ?? []).map((m) => [m.slug, m]));
  const mapping = [];
  const toCreate = [];
  const mapErrors = [];

  for (const slug of slugs) {
    const ex = getRepoExercise(slug);
    const customSpec = customExercises[slug];

    if (customSpec) {
      const resolved = resolveCustomExercise({
        slug,
        spec: customSpec,
        programMappingRow: programBySlug.get(slug),
        accountMappingRow: accountBySlug.get(slug),
        index,
        allowCreate: false,
      });

      if (resolved.ok) {
        mapping.push({
          slug: ex.slug,
          repoTitle: ex.title,
          hevyId: resolved.hevyId,
          hevyTitle: resolved.hevyTitle,
          matchScore: 1,
        });
      } else if (resolved.needsCreate) {
        toCreate.push({
          slug: ex.slug,
          title: customSpec.title,
          file: ex.filepath,
        });
      } else {
        mapErrors.push(resolved.error ?? `Could not map custom slug ${slug}`);
        toCreate.push({
          slug: ex.slug,
          title: customSpec.title,
          file: ex.filepath,
          note: 'blocked — fix errors first',
        });
      }
      continue;
    }

    const existing = accountBySlug.get(slug) ?? programBySlug.get(slug);
    if (existing?.hevyId && !existing.proxyNote) {
      mapping.push({ ...existing, repoTitle: ex.title });
      continue;
    }

    const match = findBestMatch(ex.title, hevyTemplates, 0.98);
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
  writeStatusMd(paths.status, manifest, mapping, toCreate, mapErrors);

  console.log(`Wrote ${paths.mapping}`);
  console.log(`Wrote ${paths.status}`);
  console.log(`Matched: ${mapping.length}, To create: ${toCreate.length}`);
  if (mapErrors.length) {
    console.error(`\n${mapErrors.length} error(s) — fix before push:`);
    for (const e of mapErrors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
