import { CATALOG } from '#shared/features/catalog.ts';
import { EDITION } from '#shared/editions/constants.ts';
import { visibleCatalog } from '#shared/editions/hidden.ts';
import { reportLines } from '#kernel/flags/resolve.ts';
import { wrapperContext } from './context.ts';
import { start } from './start.ts';

if (wrapperContext.environment.listFeatures) {
  for (const line of reportLines(visibleCatalog(CATALOG, EDITION), wrapperContext.flags, wrapperContext.capabilities)) console.log(line);
  process.exit();
}
start(wrapperContext);
