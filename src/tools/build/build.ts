import path from 'node:path';
import * as esbuild from 'esbuild';
import { REPO_ROOT, CONSOLE_BUNDLE_DIR, CONSOLE_BUNDLE_FILE } from '#kernel/config/paths.ts';
import { CONSOLE_SOURCE_ENTRY, BROWSER_TARGET } from './constants.ts';

export const defaultConsoleOutFile = path.join(CONSOLE_BUNDLE_DIR, CONSOLE_BUNDLE_FILE);

export const consoleBuildOptions = (outfile: string = defaultConsoleOutFile): esbuild.BuildOptions => ({
  entryPoints: [path.join(REPO_ROOT, CONSOLE_SOURCE_ENTRY)],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: BROWSER_TARGET,
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'warning',
});

export async function buildConsole(outfile: string = defaultConsoleOutFile): Promise<string> {
  await esbuild.build(consoleBuildOptions(outfile));
  return outfile;
}

export async function watchConsole(outfile: string = defaultConsoleOutFile): Promise<esbuild.BuildContext> {
  const context = await esbuild.context(consoleBuildOptions(outfile));
  await context.watch();
  return context;
}
