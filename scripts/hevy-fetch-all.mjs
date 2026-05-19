#!/usr/bin/env node
/**
 * Fetch all exercise templates, routines, and routine folders from Hevy API
 * and save them as JSON files in libs/hevy/cache/.
 *
 * Usage: node scripts/hevy-fetch-all.mjs
 * Requires: HEVY_API_KEY_KHOIPHAN21 (or HEVY_API_KEY)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchAllPaginated,
  getHevyApiKey,
} from '../libs/hevy/hevy-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../libs/hevy/cache');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function writeJson(filename, data) {
  const filepath = path.join(CACHE_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${filepath}`);
}

async function main() {
  getHevyApiKey(); // validate early
  ensureCacheDir();

  console.log('Fetching exercise templates...');
  const exerciseTemplates = await fetchAllPaginated('exercise_templates', {
    pageSize: 100,
  });
  writeJson('exercise-templates.json', {
    fetchedAt: new Date().toISOString(),
    count: exerciseTemplates.length,
    data: exerciseTemplates,
  });

  console.log('Fetching routines...');
  const routines = await fetchAllPaginated('routines', { pageSize: 10 });
  writeJson('routines-all.json', {
    fetchedAt: new Date().toISOString(),
    count: routines.length,
    data: routines,
  });

  console.log('Fetching routine folders...');
  const routineFolders = await fetchAllPaginated('routine_folders', {
    pageSize: 10,
  });
  writeJson('routine-folders.json', {
    fetchedAt: new Date().toISOString(),
    count: routineFolders.length,
    data: routineFolders,
  });

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
