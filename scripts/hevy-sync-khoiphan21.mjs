#!/usr/bin/env node
/**
 * Validate and push every program bundle for account khoiphan21.
 *
 * Usage:
 *   npm run hevy:sync-khoiphan21
 *   npm run hevy:sync-khoiphan21 -- --validate-only
 *   npm run hevy:sync-khoiphan21 -- --push-only
 *   npm run hevy:sync-khoiphan21 -- --dry-run
 *   npm run hevy:sync-khoiphan21 -- --allow-create
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHevyApiKey } from '../libs/hevy/hevy-client.mjs';
import {
  listProgramsForAccount,
  programSlugFromDir,
} from '../libs/hevy/program-bundle.mjs';
import {
  buildTemplateIndexForAccount,
  loadExerciseTemplates,
} from '../libs/hevy/template-index.mjs';
import { validateAccountTemplates } from '../libs/hevy/validate.mjs';
import { runPush, parsePushArgs } from './hevy-push.mjs';

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

function runValidateScript(slug, extraArgs) {
  const scriptPath = path.join(__dirname, 'hevy-validate.mjs');
  const result = spawnSync(process.execPath, [scriptPath, slug, ...extraArgs], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

async function main() {
  const { validateOnly, pushOnly, forwardArgs } = parseArgs(process.argv.slice(2));
  const pushOpts = parsePushArgs(forwardArgs);

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

  let templateIndex = null;
  const dryRun = forwardArgs.includes('--dry-run');

  if (!validateOnly && !dryRun) {
    console.log('\n========== Refresh exercise template cache ==========\n');
    getHevyApiKey();
    const loaded = await loadExerciseTemplates({ fetch: true, writeCache: true });
    templateIndex = buildTemplateIndexForAccount(loaded.templates, ACCOUNT);
    console.log(`Cached ${loaded.templates.length} exercise templates\n`);
  } else if (!dryRun) {
    const loaded = await loadExerciseTemplates({ requireCache: true });
    templateIndex = buildTemplateIndexForAccount(loaded.templates, ACCOUNT);
  }

  if (templateIndex) {
    const accountErrors = await validateAccountTemplates(ACCOUNT, { templateIndex });
    if (accountErrors.length > 0) {
      console.error('Account template validation failed:\n');
      for (const e of accountErrors) console.error(`  - ${e}`);
      process.exit(1);
    }
  }

  let exitCode = 0;
  const sortedDirs = [...programDirs].sort((a, b) =>
    programSlugFromDir(a).localeCompare(programSlugFromDir(b))
  );

  for (const dir of sortedDirs) {
    const slug = programSlugFromDir(dir);
    console.log(`\n========== ${slug} ==========\n`);

    if (!pushOnly) {
      const code = runValidateScript(slug, forwardArgs);
      if (code !== 0) {
        exitCode = code;
        break;
      }
    }

    if (!validateOnly) {
      try {
        const result = await runPush(slug, {
          templateIndex,
          dryRun: pushOpts.dryRun,
          fetch: false,
          noFetch: true,
          allowCreate: pushOpts.allowCreate,
          forceCreateSlug: pushOpts.forceCreateSlug,
          recreateRoutines: pushOpts.recreateRoutines,
          iKnowRecreate: pushOpts.iKnowRecreate,
          skipReconcile: pushOpts.skipReconcile,
          allowDuplicateRoutines: pushOpts.allowDuplicateRoutines,
          refreshCacheAfter: false,
        });
        templateIndex = result.templateIndex;
      } catch (err) {
        console.error(err);
        exitCode = 1;
        break;
      }
    }
  }

  if (exitCode === 0 && !validateOnly && !dryRun) {
    console.log('\n========== Refresh exercise cache (post-push) ==========\n');
    getHevyApiKey();
    const loaded = await loadExerciseTemplates({ fetch: true, writeCache: true });
    console.log(`Cached ${loaded.templates.length} exercise templates`);
    console.log(`\nDone: ${slugs.length} program(s) for ${ACCOUNT}`);
  } else if (exitCode === 0) {
    console.log(`\nDone: ${slugs.length} program(s) for ${ACCOUNT}`);
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
