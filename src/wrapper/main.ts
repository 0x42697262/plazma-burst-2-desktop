import { createRequire } from 'node:module';
import { CATALOG } from '#shared/features/catalog.ts';
import { reportLines } from '#kernel/flags/resolve.ts';
import { wrapperContext } from './context.ts';
import { LEGACY_MAIN } from './paths.ts';

const requireLegacy = createRequire(import.meta.url);

if (wrapperContext.environment.listFeatures) {
  for (const line of reportLines(CATALOG, wrapperContext.flags)) console.log(line);
  process.exit();
}
requireLegacy(LEGACY_MAIN);
