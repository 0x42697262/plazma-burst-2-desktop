import fs from 'node:fs/promises';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { REPO_ROOT, CONSOLE_BUNDLE_DIR, CONSOLE_BUNDLE_FILE } from '#kernel/config/paths.ts';
import {
  LAUNCHER_DIST_DIR, LAUNCHER_PRELOAD_SOURCE, LAUNCHER_SCRIPT_SOURCE, LAUNCHER_SOURCE_DIR, LAUNCHER_STATIC_FILES,
} from '#features/server_list/paths.ts';
import { RUNTIME_BUNDLE, RUNTIME_SOURCE } from '#features/hooks/paths.ts';
import { BROWSER_TARGET, CONSOLE_SOURCE_ENTRY, ELECTRON_MODULE, LAUNCHER_PRELOAD_FILE, LAUNCHER_SCRIPT_FILE, NODE_TARGET } from './constants.ts';

export const defaultConsoleOutFile = path.join(CONSOLE_BUNDLE_DIR, CONSOLE_BUNDLE_FILE);

const shared: esbuild.BuildOptions = { bundle: true, sourcemap: 'linked', legalComments: 'none', logLevel: 'warning' };

export const consoleBuildOptions = (outfile: string = defaultConsoleOutFile): esbuild.BuildOptions => ({
  ...shared,
  entryPoints: [path.join(REPO_ROOT, CONSOLE_SOURCE_ENTRY)],
  outfile,
  format: 'esm',
  platform: 'browser',
  target: BROWSER_TARGET,
});

export const launcherPageOptions = (outDir: string = LAUNCHER_DIST_DIR): esbuild.BuildOptions => ({
  ...shared,
  entryPoints: [LAUNCHER_SCRIPT_SOURCE],
  outfile: path.join(outDir, LAUNCHER_SCRIPT_FILE),
  format: 'iife',
  platform: 'browser',
  target: BROWSER_TARGET,
});

export const launcherPreloadOptions = (outDir: string = LAUNCHER_DIST_DIR): esbuild.BuildOptions => ({
  ...shared,
  entryPoints: [LAUNCHER_PRELOAD_SOURCE],
  outfile: path.join(outDir, LAUNCHER_PRELOAD_FILE),
  format: 'cjs',
  platform: 'node',
  target: NODE_TARGET,
  external: [ELECTRON_MODULE],
});

async function copyLauncherStatic(outDir: string): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  for (const name of LAUNCHER_STATIC_FILES) await fs.copyFile(path.join(LAUNCHER_SOURCE_DIR, name), path.join(outDir, name));
}

export const hooksRuntimeOptions = (outfile: string = RUNTIME_BUNDLE): esbuild.BuildOptions => ({
  ...shared,
  sourcemap: false,
  entryPoints: [RUNTIME_SOURCE],
  outfile,
  format: 'cjs',
  platform: 'neutral',
  target: BROWSER_TARGET,
});

export async function buildHooksRuntime(outfile: string = RUNTIME_BUNDLE): Promise<string> {
  await esbuild.build(hooksRuntimeOptions(outfile));
  return outfile;
}

export async function buildConsole(outfile: string = defaultConsoleOutFile): Promise<string> {
  await esbuild.build(consoleBuildOptions(outfile));
  return outfile;
}

export async function buildLauncher(outDir: string = LAUNCHER_DIST_DIR): Promise<string> {
  await Promise.all([esbuild.build(launcherPageOptions(outDir)), esbuild.build(launcherPreloadOptions(outDir)), copyLauncherStatic(outDir)]);
  return outDir;
}

export async function buildAll(): Promise<string[]> {
  return Promise.all([buildConsole(), buildLauncher(), buildHooksRuntime()]);
}

export async function watchAll(): Promise<esbuild.BuildContext[]> {
  const contexts = await Promise.all([consoleBuildOptions(), launcherPageOptions(), launcherPreloadOptions(), hooksRuntimeOptions()].map((options) => esbuild.context(options)));
  await copyLauncherStatic(LAUNCHER_DIST_DIR);
  await Promise.all(contexts.map((context) => context.watch()));
  return contexts;
}
