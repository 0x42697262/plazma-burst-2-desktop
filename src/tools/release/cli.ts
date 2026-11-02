import fs from 'node:fs/promises';
import path from 'node:path';
import { build as packageApp } from 'electron-builder';
import { REPO_ROOT, DIST_DIR } from '#kernel/config/paths.ts';
import { buildAll } from '#tools/build/build.ts';
import { readEdition } from '#tools/build/edition-file.ts';
import { builderConfig, stagedPackage } from './config.ts';
import { FAILED_EXIT_CODE, FIRST_USER_ARGUMENT, JSON_INDENT } from './constants.ts';
import { ARG, DIST_FOLDER, ELECTRON_PACKAGE, LINE_JOIN, NEVER_PUBLISH, PACKAGE_FILE, PLATFORM, RELEASE_FOLDER, SOURCE_MAP_SUFFIX, STAGING_FOLDER, type Platform } from './keys.ts';
import { TEXT } from './text.ts';

type Options = { edition: string | null; platforms: Platform[]; help: boolean };

function parseArgs(args: readonly string[]): Options {
  const options: Options = { edition: null, platforms: [], help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === ARG.edition) options.edition = args[++index] ?? null;
    else if (arg === ARG.linux) options.platforms.push(PLATFORM.linux);
    else if (arg === ARG.windows) options.platforms.push(PLATFORM.windows);
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
  const { edition, problems } = readEdition(options.edition);
  if (problems.length) throw new Error(problems.join(LINE_JOIN));
  if (edition.features === null) console.warn(TEXT.everyFeature);
  console.log(TEXT.building(edition.name, edition.features ?? []));

  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await buildAll(edition);

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
