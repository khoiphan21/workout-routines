#!/usr/bin/env node
/**
 * Fetch routine folders from Hevy API and save to libs/hevy/cache/routine-folders.json
 *
 * Usage: node scripts/hevy-fetch-routine-folders.mjs
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

async function main() {
  getHevyApiKey();
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  const items = await fetchAllPaginated('routine_folders', { pageSize: 10 });
  const data = { fetchedAt: new Date().toISOString(), count: items.length, data: items };
  const outPath = path.join(CACHE_DIR, 'routine-folders.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${items.length} routine folders to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
