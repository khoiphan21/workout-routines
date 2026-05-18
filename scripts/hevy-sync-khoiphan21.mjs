#!/usr/bin/env node
/**
 * Validate and push every program bundle for account khoiphan21.
 *
 * Usage:
 *   npm run hevy:sync-khoiphan21
 *   npm run hevy:sync-khoiphan21 -- --validate-only
 *   npm run hevy:sync-khoiphan21 -- --push-only
 *   npm run hevy:sync-khoiphan21 -- --dry-run
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listProgramsForAccount,
  programSlugFromDir,
} from '../libs/hevy/program-bundle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ACCOUNT = 'khoiphan21';

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('-')));
  return {
    validateOnly: flags.has('--validate-only'),
    pushOnly: flags.has('--push-only'),
    forwardArgs: argv.filter((a) => !a.startsWith('--validate-only') && !a.startsWith('--push-only')),
  };
}

function runScript(scriptName, slug, extraArgs) {
  const scriptPath = path.join(__dirname, scriptName);
  const args = [scriptPath, slug, ...extraArgs];
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

function main() {
  const { validateOnly, pushOnly, forwardArgs } = parseArgs(process.argv.slice(2));

  if (validateOnly && pushOnly) {
    console.error('Use only one of --validate-only or --push-only');
    process.exit(1);
  }

  const programDirs = listProgramsForAccount(ACCOUNT);
  if (programDirs.length === 0) {
    console.error(`No programs with hevy/manifest.json for account "${ACCOUNT}"`);
    process.exit(1);
  }

  const slugs = programDirs.map((dir) => programSlugFromDir(dir)).sort();
  console.log(`Account ${ACCOUNT}: ${slugs.join(', ')}`);

  let exitCode = 0;

  for (const dir of programDirs.sort((a, b) =>
    programSlugFromDir(a).localeCompare(programSlugFromDir(b))
  )) {
    const slug = programSlugFromDir(dir);
    console.log(`\n========== ${slug} ==========\n`);

    if (!pushOnly) {
      const code = runScript('hevy-validate.mjs', slug, forwardArgs);
      if (code !== 0) {
        exitCode = code;
        break;
      }
    }

    if (!validateOnly) {
      const code = runScript('hevy-push.mjs', slug, forwardArgs);
      if (code !== 0) {
        exitCode = code;
        break;
      }
    }
  }

  if (exitCode === 0) {
    console.log(`\nDone: ${slugs.length} program(s) for ${ACCOUNT}`);
  }

  process.exit(exitCode);
}

main();
