#!/usr/bin/env node
/**
 * Fetch routines from Hevy API and save to libs/hevy/cache/routines-all.json
 *
 * Usage: node scripts/hevy-fetch-routines.mjs
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

  const items = await fetchAllPaginated('routines', { pageSize: 10 });
  const data = { fetchedAt: new Date().toISOString(), count: items.length, data: items };
  const outPath = path.join(CACHE_DIR, 'routines-all.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${items.length} routines to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
