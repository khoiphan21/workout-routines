/**
 * Resolve program paths and load per-program Hevy bundles.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const CACHE_DIR = path.join(__dirname, 'cache');
export const ACCOUNT_DIR = path.join(__dirname, 'account');

export function normTitle(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} arg - programs/user/slug, user/slug, or slug
 * @returns {string} Absolute path to program directory
 */
export function resolveProgramDir(arg) {
  if (!arg || arg.startsWith('-')) {
    throw new Error(
      'Program path required.\nExample: npm run hevy:push -- push-pull-homegym'
    );
  }

  const normalized = arg.replace(/\\/g, '/').replace(/\/$/, '');

  if (normalized.includes('/')) {
    const withPrograms = normalized.startsWith('programs/')
      ? path.join(REPO_ROOT, normalized)
      : path.join(REPO_ROOT, 'programs', normalized);
    if (fs.existsSync(path.join(withPrograms, 'hevy', 'manifest.json'))) {
      return withPrograms;
    }
  }

  const matches = [];
  const programsRoot = path.join(REPO_ROOT, 'programs');
  if (!fs.existsSync(programsRoot)) {
    throw new Error(`No programs directory at ${programsRoot}`);
  }

  for (const user of fs.readdirSync(programsRoot, { withFileTypes: true })) {
    if (!user.isDirectory()) continue;
    const candidate = path.join(programsRoot, user.name, normalized);
    if (fs.existsSync(path.join(candidate, 'hevy', 'manifest.json'))) {
      matches.push(candidate);
    }
  }

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous program slug "${normalized}". Use full path:\n${matches.join('\n')}`
    );
  }

  throw new Error(`Program not found: ${arg}`);
}

export function getBundlePaths(programDir) {
  const hevyDir = path.join(programDir, 'hevy');
  return {
    hevyDir,
    manifest: path.join(hevyDir, 'manifest.json'),
    routines: path.join(hevyDir, 'routines.json'),
    mapping: path.join(hevyDir, 'mapping.json'),
    customExercises: path.join(hevyDir, 'custom-exercises.json'),
    status: path.join(hevyDir, 'status.md'),
  };
}

export function loadManifest(programDir) {
  const { manifest: manifestPath } = getBundlePaths(programDir);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function accountMappingPath(account) {
  return path.join(ACCOUNT_DIR, account, 'exercise-mapping.json');
}

export function loadAccountMapping(account) {
  const p = accountMappingPath(account);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function saveAccountMapping(account, doc) {
  const p = accountMappingPath(account);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(doc, null, 2), 'utf8');
  return p;
}

export function mergeAccountMapping(accountMapping, programMapping) {
  const base = accountMapping ?? {
    generatedAt: new Date().toISOString(),
    mapping: [],
    toCreate: [],
  };
  const bySlug = new Map((base.mapping ?? []).map((m) => [m.slug, { ...m }]));

  for (const row of programMapping.mapping ?? []) {
    bySlug.set(row.slug, { ...row });
  }

  const merged = {
    ...base,
    mapping: [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    generatedAt: new Date().toISOString(),
  };
  merged.matched = merged.mapping.length;
  return merged;
}

export function filterMappingBySlugs(fullMapping, slugs) {
  const slugSet = new Set(slugs);
  const mapping = (fullMapping.mapping ?? []).filter((m) => slugSet.has(m.slug));
  const mappedSlugs = new Set(mapping.map((m) => m.slug));
  const toCreate = (fullMapping.toCreate ?? []).filter(
    (e) => slugSet.has(e.slug) && !mappedSlugs.has(e.slug)
  );
  return {
    generatedAt: fullMapping.generatedAt,
    programSlugs: [...slugSet].sort(),
    matched: mapping.length,
    toCreate,
    mapping,
  };
}

export function loadBundle(programDir) {
  const paths = getBundlePaths(programDir);
  const manifest = loadManifest(programDir);

  for (const [key, filePath] of Object.entries(paths)) {
    if (key === 'hevyDir' || key === 'status') continue;
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing bundle file: ${filePath}`);
    }
  }

  return {
    programDir,
    paths,
    manifest,
    routines: JSON.parse(fs.readFileSync(paths.routines, 'utf8')),
    mapping: JSON.parse(fs.readFileSync(paths.mapping, 'utf8')),
    customExercises: JSON.parse(fs.readFileSync(paths.customExercises, 'utf8')),
  };
}

/**
 * Copy Hevy routine id / folder_id from an existing routines.json onto a new doc (by title).
 * @param {object} routinesDoc - routines.json object with `data` array
 * @param {string} existingPath - path to previous routines.json
 * @returns {object} routinesDoc (mutated)
 */
export function preserveRoutineIds(routinesDoc, existingPath) {
  if (!fs.existsSync(existingPath)) return routinesDoc;
  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  const byTitle = new Map(
    (existing.data ?? [])
      .filter((r) => r.id)
      .map((r) => [r.title, { id: r.id, folder_id: r.folder_id }])
  );
  for (const r of routinesDoc.data ?? []) {
    const meta = byTitle.get(r.title);
    if (meta) {
      r.id = meta.id;
      if (meta.folder_id) r.folder_id = meta.folder_id;
    }
  }
  return routinesDoc;
}

export function listProgramDirs() {
  const out = [];
  const programsRoot = path.join(REPO_ROOT, 'programs');
  if (!fs.existsSync(programsRoot)) return out;

  for (const user of fs.readdirSync(programsRoot, { withFileTypes: true })) {
    if (!user.isDirectory()) continue;
    const userDir = path.join(programsRoot, user.name);
    for (const prog of fs.readdirSync(userDir, { withFileTypes: true })) {
      if (!prog.isDirectory()) continue;
      const dir = path.join(userDir, prog.name);
      if (fs.existsSync(path.join(dir, 'hevy', 'manifest.json'))) {
        out.push(dir);
      }
    }
  }
  return out;
}
