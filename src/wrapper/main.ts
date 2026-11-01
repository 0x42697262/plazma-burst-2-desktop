import { CATALOG } from '#shared/features/catalog.ts';
import { reportLines } from '#kernel/flags/resolve.ts';
import { wrapperContext } from './context.ts';
import { startApp } from './app.ts';

if (wrapperContext.environment.listFeatures) {
  for (const line of reportLines(CATALOG, wrapperContext.flags)) console.log(line);
  process.exit();
}
startApp(wrapperContext);
