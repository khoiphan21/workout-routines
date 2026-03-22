#!/usr/bin/env node
/**
 * Fetch routines from Hevy API and save to libs/hevy/data/routines.json
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
const DATA_DIR = path.resolve(__dirname, '../libs/hevy/data');

async function main() {
  getHevyApiKey();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const items = await fetchAllPaginated('routines', { pageSize: 10 });
  const data = { fetchedAt: new Date().toISOString(), count: items.length, data: items };
  const outPath = path.join(DATA_DIR, 'routines.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${items.length} routines to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
