/**
 * Load Hevy API keys from .env.local when not already set in the environment.
 * Does not override existing process.env values.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const ENV_LOCAL = path.join(REPO_ROOT, '.env.local');

let loaded = false;

function parseValue(raw) {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

/**
 * Load variables from .env.local into process.env (only unset keys).
 */
export function loadEnvLocal() {
  if (loaded) return;
  loaded = true;

  if (!fs.existsSync(ENV_LOCAL)) return;

  const content = fs.readFileSync(ENV_LOCAL, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = parseValue(trimmed.slice(eq + 1));

    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}
