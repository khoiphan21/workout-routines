/**
 * Shared exercise template index: load cache, detect duplicates, resolve canonical ids.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fetchAllPaginated, getHevyApiKey } from './hevy-client.mjs';
import {
  CACHE_DIR,
  listProgramsForAccount,
  loadBundle,
  loadManifest,
  normTitle,
} from './program-bundle.mjs';

export const PLACEHOLDER_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001';
export const EXERCISE_TEMPLATES_CACHE = path.join(CACHE_DIR, 'exercise-templates.json');

const DEFAULT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function cacheMaxAgeMs() {
  const raw = process.env.HEVY_CACHE_MAX_AGE_MS;
  if (raw != null && raw !== '') {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return DEFAULT_CACHE_MAX_AGE_MS;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.fetch] - fetch from API
 * @param {boolean} [opts.writeCache=true]
 * @param {object[]} [opts.templates] - use in-memory list (skip disk read)
 * @param {boolean} [opts.requireCache] - error if cache missing and not fetching
 * @returns {Promise<{ templates: object[], fetchedAt: string|null, fromFetch: boolean }>}
 */
export async function loadExerciseTemplates(opts = {}) {
  const { fetch = false, writeCache = true, templates: provided, requireCache = false } = opts;

  if (provided) {
    return { templates: provided, fetchedAt: null, fromFetch: false };
  }

  if (fetch) {
    getHevyApiKey();
    const items = await fetchAllPaginated('exercise_templates', { pageSize: 100 });
    const fetchedAt = new Date().toISOString();
    if (writeCache) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(
        EXERCISE_TEMPLATES_CACHE,
        JSON.stringify({ fetchedAt, count: items.length, data: items }, null, 2),
        'utf8'
      );
    }
    return { templates: items, fetchedAt, fromFetch: true };
  }

  if (!fs.existsSync(EXERCISE_TEMPLATES_CACHE)) {
    if (requireCache) {
      throw new Error(
        `Missing ${EXERCISE_TEMPLATES_CACHE}. Run: npm run hevy:fetch-exercises (or hevy:push without --no-fetch)`
      );
    }
    return { templates: [], fetchedAt: null, fromFetch: false };
  }

  const raw = JSON.parse(fs.readFileSync(EXERCISE_TEMPLATES_CACHE, 'utf8'));
  const templates = raw.data ?? raw;
  return {
    templates: Array.isArray(templates) ? templates : [],
    fetchedAt: raw.fetchedAt ?? null,
    fromFetch: false,
  };
}

/**
 * @param {string|null} fetchedAt - ISO timestamp
 * @returns {string|null} warning message if stale
 */
export function cacheStaleWarning(fetchedAt) {
  const maxAge = cacheMaxAgeMs();
  if (maxAge === 0 || !fetchedAt) return null;
  const age = Date.now() - Date.parse(fetchedAt);
  if (Number.isNaN(age) || age <= maxAge) return null;
  const hours = Math.round(age / 3600000);
  return `Exercise cache is ${hours}h old (fetchedAt ${fetchedAt}). Run npm run hevy:fetch-exercises or push without --no-fetch.`;
}

/**
 * @param {object[]} templates
 * @param {object} [canonical] - from collectCanonicalIds
 * @returns {object} templateIndex
 */
export function buildTemplateIndex(templates, canonical = null) {
  const byId = new Map();
  const byTitle = new Map();
  const duplicateTitles = new Set();
  const liveIds = new Set();

  for (const t of templates) {
    const id = t.id ?? t.exercise_template_id;
    if (!id) continue;
    liveIds.add(id);
    const title = t.title ?? t.name ?? t.exercise_name ?? '';
    byId.set(id, { id, title, raw: t });

    const key = normTitle(title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push({ id, title });
  }

  for (const [key, arr] of byTitle) {
    if (arr.length > 1) duplicateTitles.add(key);
  }

  const preferredByTitle = canonical?.preferredByTitle ?? new Map();
  const templatesByTitle = new Map();

  for (const [key, arr] of byTitle) {
    if (arr.length === 1) {
      templatesByTitle.set(key, arr[0]);
      continue;
    }
    const preferredId = preferredByTitle.get(key);
    if (preferredId && liveIds.has(preferredId)) {
      const match = arr.find((x) => x.id === preferredId);
      if (match) {
        templatesByTitle.set(key, match);
        continue;
      }
    }
    // ambiguous — no single entry in templatesByTitle
  }

  return {
    templates,
    liveIds,
    byId,
    byTitle,
    duplicateTitles,
    templatesByTitle,
    preferredByTitle,
  };
}

/**
 * @param {string} account
 * @returns {{ ids: Set, idSources: Map, preferredByTitle: Map, slugByPreferredId: Map }}
 */
export function collectCanonicalIds(account) {
  const ids = new Set();
  const idSources = new Map();
  const preferredByTitle = new Map();
  const preferredPriority = new Map();
  const slugByPreferredId = new Map();

  function add(id, source) {
    if (!id || id === PLACEHOLDER_TEMPLATE_ID) return;
    ids.add(id);
    if (!idSources.has(id)) idSources.set(id, []);
    idSources.get(id).push(source);
  }

  function prefer(title, id, priority, meta = {}) {
    const key = normTitle(title);
    const cur = preferredByTitle.get(key);
    if (!cur || priority > (preferredPriority.get(cur) ?? 0)) {
      preferredByTitle.set(key, id);
      preferredPriority.set(id, priority);
      if (meta.slug) slugByPreferredId.set(id, meta);
    }
  }

  const accountMappingPath = path.join(CACHE_DIR, '../account', account, 'exercise-mapping.json');
  if (fs.existsSync(accountMappingPath)) {
    const doc = JSON.parse(fs.readFileSync(accountMappingPath, 'utf8'));
    for (const row of doc.mapping ?? []) {
      add(row.hevyId, `account mapping: ${row.slug}`);
      if (row.hevyId && row.hevyTitle) {
        prefer(row.hevyTitle, row.hevyId, 2, {
          slug: row.slug,
          programId: 'account',
          title: row.hevyTitle,
        });
      }
    }
  }

  for (const programDir of listProgramsForAccount(account)) {
    const manifest = loadManifest(programDir);
    const bundle = loadBundle(programDir);

    for (const row of bundle.mapping.mapping ?? []) {
      add(row.hevyId, `${manifest.id}/mapping: ${row.slug}`);
      if (row.hevyId && row.hevyTitle) {
        prefer(row.hevyTitle, row.hevyId, 3, {
          slug: row.slug,
          programId: manifest.id,
          title: row.hevyTitle,
        });
      }
    }

    for (const routine of bundle.routines.data ?? []) {
      for (const ex of routine.exercises ?? []) {
        const tid = ex.exercise_template_id;
        if (tid && tid !== PLACEHOLDER_TEMPLATE_ID) {
          add(tid, `${manifest.id}/routine: ${routine.title} → ${ex.title}`);
          prefer(ex.title, tid, 1);
        }
      }
    }

    for (const spec of Object.values(bundle.customExercises ?? {})) {
      if (spec?.title) {
        const row = (bundle.mapping.mapping ?? []).find(
          (m) => normTitle(m.hevyTitle ?? '') === normTitle(spec.title)
        );
        if (row?.hevyId) {
          prefer(spec.title, row.hevyId, 3, {
            slug: row.slug,
            programId: manifest.id,
            title: spec.title,
          });
        }
      }
    }
  }

  return { ids, idSources, preferredByTitle, slugByPreferredId };
}

/**
 * Rebuild index with canonical preferences (call after collectCanonicalIds).
 * @param {object[]} templates
 * @param {string} account
 */
export function buildTemplateIndexForAccount(templates, account) {
  const canonical = collectCanonicalIds(account);
  const index = buildTemplateIndex(templates, canonical);
  index.canonical = canonical;
  return index;
}

/**
 * @param {object} params
 * @param {string} params.slug
 * @param {object} params.spec - custom-exercises entry
 * @param {object} [params.programMappingRow]
 * @param {object} [params.accountMappingRow]
 * @param {object} params.index - buildTemplateIndex result
 * @param {boolean} [params.allowCreate]
 * @param {boolean} [params.forceCreate]
 */
export function resolveCustomExercise({
  slug,
  spec,
  programMappingRow,
  accountMappingRow,
  index,
  allowCreate = false,
  forceCreate = false,
}) {
  const title = spec?.title?.trim();
  if (!title) {
    return { ok: false, error: `custom-exercises.json["${slug}"]: missing title`, needsCreate: false };
  }

  const titleKey = normTitle(title);
  const tryId = (id, source, hevyTitle, mappingRowForTitleCheck) => {
    if (!id || id.startsWith('dry-run-')) {
      return undefined;
    }
    if (!index.liveIds.has(id)) {
      return {
        ok: false,
        error: `Slug "${slug}": canonical id ${id} (${source}) is missing on Hevy. Run hevy:list-duplicates --fetch, clean up, then hevy:push --allow-create.`,
        needsCreate: false,
      };
    }
    if (
      mappingRowForTitleCheck?.hevyTitle &&
      normTitle(mappingRowForTitleCheck.hevyTitle) !== titleKey
    ) {
      return {
        ok: false,
        error: `Slug "${slug}": mapping hevyTitle "${mappingRowForTitleCheck.hevyTitle}" does not match custom-exercises title "${title}"`,
        needsCreate: false,
      };
    }
    const entry = index.byId.get(id);
    return {
      ok: true,
      hevyId: id,
      hevyTitle: entry?.title ?? hevyTitle ?? title,
      source,
    };
  };

  if (forceCreate) {
    return { ok: false, needsCreate: true, forceCreate: true };
  }

  if (programMappingRow?.hevyId) {
    const r = tryId(
      programMappingRow.hevyId,
      'program mapping',
      programMappingRow.hevyTitle,
      programMappingRow
    );
    if (r?.ok) return r;
    if (r && !r.ok) return r;
  }

  if (accountMappingRow?.hevyId && accountMappingRow.hevyId !== programMappingRow?.hevyId) {
    const r = tryId(
      accountMappingRow.hevyId,
      'account mapping',
      accountMappingRow.hevyTitle,
      programMappingRow
    );
    if (r?.ok) return r;
    if (r && !r.ok) return r;
  }

  if (index.duplicateTitles.has(titleKey)) {
    const count = index.byTitle.get(titleKey)?.length ?? 0;
    const preferred = index.preferredByTitle.get(titleKey);
    if (preferred && index.liveIds.has(preferred)) {
      const entry = index.byId.get(preferred);
      return {
        ok: true,
        hevyId: preferred,
        hevyTitle: entry?.title ?? title,
        source: 'canonical (duplicate titles on Hevy)',
      };
    }
    return {
      ok: false,
      error: `${count} Hevy templates titled "${title}". Run: npm run hevy:list-duplicates -- --fetch and delete extras.`,
      needsCreate: false,
    };
  }

  const single = index.templatesByTitle.get(titleKey);
  if (single) {
    return {
      ok: true,
      hevyId: single.id,
      hevyTitle: single.title,
      source: 'cache title match',
    };
  }

  const idsForTitle = index.byTitle.get(titleKey);
  if (idsForTitle?.length === 1) {
    return {
      ok: true,
      hevyId: idsForTitle[0].id,
      hevyTitle: idsForTitle[0].title,
      source: 'cache title match',
    };
  }

  if (allowCreate || forceCreate) {
    return { ok: false, needsCreate: true };
  }

  return {
    ok: false,
    error: `No Hevy template for "${title}" (slug ${slug}). Run hevy:map, then hevy:push --allow-create (or add to mapping.toCreate).`,
    needsCreate: true,
  };
}

/** @param {object} index */
export function registerTemplate(index, id, title) {
  const key = normTitle(title);
  index.liveIds.add(id);
  index.byId.set(id, { id, title, raw: { id, title } });
  const entry = { id, title };
  index.templatesByTitle.set(key, entry);
  const arr = index.byTitle.get(key) ?? [];
  if (!arr.some((x) => x.id === id)) arr.push(entry);
  index.byTitle.set(key, arr);
  if (arr.length > 1) index.duplicateTitles.add(key);
}
