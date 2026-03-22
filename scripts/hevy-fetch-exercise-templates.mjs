#!/usr/bin/env node
/**
 * Fetch exercise templates from Hevy API and save to libs/hevy/data/exercise-templates.json
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
const DATA_DIR = path.resolve(__dirname, '../libs/hevy/data');
const OUT_FILE = path.join(DATA_DIR, 'exercise-templates.json');

async function main() {
  getHevyApiKey();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const items = await fetchAllPaginated('exercise_templates', { pageSize: 100 });
  const data = { fetchedAt: new Date().toISOString(), count: items.length, data: items };
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${items.length} exercise templates to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
