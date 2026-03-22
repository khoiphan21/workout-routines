/**
 * Hevy API client for fetching exercise templates, routines, and routine folders.
 * API docs: https://api.hevyapp.com/docs/
 * Env: HEVY_API_KEY_KHOIPHAN21 or HEVY_API_KEY
 */

const HEVY_BASE = 'https://api.hevyapp.com/v1';

export function getHevyApiKey() {
  const key =
    process.env.HEVY_API_KEY_KHOIPHAN21 ||
    process.env.HEVY_API_KEY ||
    process.env.HEVY_API_TOKEN;
  if (!key) {
    throw new Error(
      'Missing Hevy API key. Set HEVY_API_KEY_KHOIPHAN21, HEVY_API_KEY, or HEVY_API_TOKEN.'
    );
  }
  return key;
}

export function getHevyHeaders() {
  return {
    'api-key': getHevyApiKey(),
    'x-api-key': 'shelobs_hevy_web',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/** Map API path to response array key (Hevy uses path-specific keys) */
const RESPONSE_KEYS = {
  exercise_templates: 'exercise_templates',
  routines: 'routines',
  routine_folders: 'routine_folders',
};

/**
 * Fetch all items from a paginated Hevy API endpoint.
 * @param {string} path - API path (e.g. 'exercise_templates')
 * @param {object} [params] - Query params (page, pageSize, etc.)
 * @returns {Promise<Array>} All items from all pages
 */
export async function fetchAllPaginated(path, params = {}) {
  const pageSize = params.pageSize ?? 100;
  const responseKey = RESPONSE_KEYS[path];
  const allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${HEVY_BASE}/${path}`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(pageSize));
    for (const [k, v] of Object.entries(params)) {
      if (k !== 'pageSize' && v != null) url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), {
      headers: getHevyHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hevy API ${path} failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    let arr = Array.isArray(data)
      ? data
      : responseKey && Array.isArray(data?.[responseKey])
        ? data[responseKey]
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.results)
              ? data.results
              : [];
    allItems.push(...arr);

    const total = data.total ?? data.totalCount ?? data.count;
    if (total != null && allItems.length >= total) {
      hasMore = false;
    } else if (arr.length < pageSize) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return allItems;
}

/**
 * Lazy-load fetch (for use with dynamic import)
 */
async function hevyFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...getHevyHeaders(), ...options.headers } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hevy API failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Fetch a single resource by ID.
 */
export async function fetchById(path, id) {
  const url = `${HEVY_BASE}/${path}/${id}`;
  return hevyFetch(url);
}

/**
 * Create a routine via Hevy API.
 * @param {object} payload - { title, exercises, folderId?, notes? }
 * @returns {Promise<object>} Created routine
 */
export async function createRoutine(payload) {
  const body = {
    routine: {
      title: payload.title,
      notes: payload.notes ?? '',
      folder_id: payload.folderId ?? null,
      exercises: (payload.exercises ?? []).map((ex) => ({
        exercise_template_id: ex.exerciseTemplateId,
        rest_seconds: ex.restSeconds ?? 60,
        notes: ex.notes ?? null,
        superset_id: ex.supersetId ?? null,
        sets: (ex.sets ?? []).map((s) => {
          const set = { type: s.type ?? 'normal' };
          if (s.reps != null) set.reps = s.reps;
          if (s.durationSeconds != null) set.duration_seconds = s.durationSeconds;
          if (s.weightKg != null) set.weight_kg = s.weightKg;
          return set;
        }),
      })),
    },
  };

  const data = await hevyFetch(`${HEVY_BASE}/routines`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const routine = data?.routine;
  return Array.isArray(routine) ? routine[0] : data;
}

/**
 * Update an existing routine.
 */
export async function updateRoutine(routineId, payload) {
  const body = {
    routine: {
      title: payload.title,
      notes: payload.notes ?? '',
      exercises: (payload.exercises ?? []).map((ex) => ({
        exercise_template_id: ex.exerciseTemplateId,
        rest_seconds: ex.restSeconds ?? 60,
        notes: ex.notes ?? null,
        superset_id: ex.supersetId ?? null,
        sets: (ex.sets ?? []).map((s) => {
          const set = { type: s.type ?? 'normal' };
          if (s.reps != null) set.reps = s.reps;
          if (s.durationSeconds != null) set.duration_seconds = s.durationSeconds;
          if (s.weightKg != null) set.weight_kg = s.weightKg;
          return set;
        }),
      })),
    },
  };

  return hevyFetch(`${HEVY_BASE}/routines/${routineId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
