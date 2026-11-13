import fs from 'node:fs/promises';
import path from 'node:path';
import { build as packageApp } from 'electron-builder';
import { REPO_ROOT, DIST_DIR } from '#kernel/config/paths.ts';
import { buildAll } from '#tools/build/build.ts';
import { readEdition, readyEdition } from '#tools/build/edition-file.ts';
import { createProbe } from '#features/server_list/adapters/probe.ts';
import { builderConfig, stagedPackage } from './config.ts';
import { FAILED_EXIT_CODE, FIRST_USER_ARGUMENT, JSON_INDENT } from './constants.ts';
import { ARG, DIST_FOLDER, ELECTRON_PACKAGE, LINE_JOIN, NEVER_PUBLISH, PACKAGE_FILE, PLATFORM, RELEASE_FOLDER, SOURCE_MAP_SUFFIX, STAGING_FOLDER, type Platform } from './keys.ts';
import { TEXT } from './text.ts';
import { TEXT as BUILD_TEXT } from '#tools/build/text.ts';
import { isServerEditionFile, readServerEdition, withPublicUrl } from '#tools/build/server-edition.ts';
import { releaseServerEdition } from './server-release.ts';

type Options = { edition: string | null; platforms: Platform[]; publicUrl: string | null; help: boolean };

function parseArgs(args: readonly string[]): Options {
  const options: Options = { edition: null, platforms: [], publicUrl: null, help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === ARG.edition) options.edition = args[++index] ?? null;
    else if (arg === ARG.linux) options.platforms.push(PLATFORM.linux);
    else if (arg === ARG.windows) options.platforms.push(PLATFORM.windows);
    else if (arg === ARG.publicUrl) options.publicUrl = args[++index] ?? null;
    else if (arg === ARG.help) options.help = true;
    else throw new Error(TEXT.unknownArgument(arg));
  }
  return options;
}

const thisSystem = (): Platform => (process.platform === 'win32' ? PLATFORM.windows : PLATFORM.linux);

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(FIRST_USER_ARGUMENT));
  if (options.help) {
    console.log(TEXT.usage);
    return;
  }
  if (!options.edition) throw new Error(TEXT.noEdition);
  if (isServerEditionFile(options.edition)) {
    const serverEdition = withPublicUrl(readServerEdition(options.edition), options.publicUrl);
    if (serverEdition.problems.length) throw new Error(serverEdition.problems.join(LINE_JOIN));
    console.log(BUILD_TEXT.serverEdition(serverEdition.name, serverEdition.server.features ?? [], serverEdition.web.features ?? []));
    const { folder, archive } = await releaseServerEdition(serverEdition);
    console.log(TEXT.serverDone(path.relative(REPO_ROOT, folder), path.relative(REPO_ROOT, archive)));
    return;
  }
  const { edition, obfuscate, defaults, problems } = await readyEdition(readEdition(options.edition), (host, port) => createProbe().fingerprint(host, port));
  if (problems.length) throw new Error(problems.join(LINE_JOIN));
  if (edition.features === null) console.warn(TEXT.everyFeature);
  console.log(TEXT.building(edition.name, edition.features ?? []));

  await fs.rm(DIST_DIR, { recursive: true, force: true });
  const { obfuscated } = await buildAll(edition, defaults, { obfuscate });
  if (obfuscated.length) console.log(BUILD_TEXT.obfuscated(obfuscated.length));

  const outDir = path.join(REPO_ROOT, RELEASE_FOLDER, edition.name);
  const appDir = path.join(outDir, STAGING_FOLDER);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.cp(DIST_DIR, path.join(appDir, DIST_FOLDER), { recursive: true, filter: (source) => !source.endsWith(SOURCE_MAP_SUFFIX) });
  const project = await readJson(path.join(REPO_ROOT, PACKAGE_FILE));
  const electron = await readJson(path.join(REPO_ROOT, ...ELECTRON_PACKAGE));
  const staged = stagedPackage(edition, { version: String(project.version), description: String(project.description), author: String(project.author ?? project.name) });
  await fs.writeFile(path.join(appDir, PACKAGE_FILE), JSON.stringify(staged, null, JSON_INDENT));

  const platforms = options.platforms.length ? options.platforms : [thisSystem()];
  console.log(TEXT.packaging(platforms, path.relative(REPO_ROOT, outDir)));
  const files = await packageApp({
    projectDir: appDir,
    publish: NEVER_PUBLISH,
    config: builderConfig({ edition, electronVersion: String(electron.version), outDir, platforms }),
    ...(platforms.includes(PLATFORM.linux) ? { linux: [] } : {}),
    ...(platforms.includes(PLATFORM.windows) ? { win: [] } : {}),
  });
  console.log(TEXT.done(files.map((file) => path.relative(REPO_ROOT, file))));
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = FAILED_EXIT_CODE;
});
