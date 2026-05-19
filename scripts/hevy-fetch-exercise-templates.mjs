#!/usr/bin/env node
/**
 * Fetch exercise templates from Hevy API and save to libs/hevy/cache/exercise-templates.json
 *
 * Usage: node scripts/hevy-fetch-exercise-templates.mjs
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
const OUT_FILE = path.join(CACHE_DIR, 'exercise-templates.json');

async function main() {
  getHevyApiKey();
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  const items = await fetchAllPaginated('exercise_templates', { pageSize: 100 });
  const data = { fetchedAt: new Date().toISOString(), count: items.length, data: items };
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${items.length} exercise templates to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
