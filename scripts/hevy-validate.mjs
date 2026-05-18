#!/usr/bin/env node
/**
 * Validate a program Hevy bundle (no API writes).
 *
 * Usage: npm run hevy:validate -- push-pull-gym-monster-2
 */

import { loadBundle, resolveProgramDir } from '../libs/hevy/program-bundle.mjs';
import { validateBundle } from '../libs/hevy/validate.mjs';

function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('-'));
  return { programArg: positional[0] };
}

function main() {
  const { programArg } = parseArgs(process.argv.slice(2));
  const programDir = resolveProgramDir(programArg);
  const bundle = loadBundle(programDir);

  const { errors, warnings } = validateBundle(bundle);

  for (const w of warnings) console.warn(`Warning: ${w}`);

  if (errors.length > 0) {
    console.error(`Validation failed (${errors.length} error(s)):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`OK: ${bundle.manifest.id} bundle is valid`);
  if (warnings.length) console.log(`(${warnings.length} warning(s))`);
}

main();
