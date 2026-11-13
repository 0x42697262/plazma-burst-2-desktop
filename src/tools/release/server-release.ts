import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { buildServerEdition, type ServerEdition } from '#tools/build/server-edition.ts';
import { fetchOfficial, latestVersion } from '#tools/fetch-game/fetch-game.ts';
import { findNames } from '#tools/find-names/find-names.ts';
import { FETCH_JOBS, JSON_INDENT } from './constants.ts';
import {
  ARCHIVE_EXTENSION, CLOUDFLARE_RANGES, GAME_FOLDER, RANGE_SEPARATOR, RELEASE_FOLDER, SERVER_EMPTY_FOLDERS, SERVER_EXAMPLE_FILE, SERVER_TEMPLATE_FILES,
  SERVER_TEMPLATES_FOLDER, SOURCE_MAP_SUFFIX, TAR_COMMAND, TEMPLATE_KEY, TEMPLATE_MARK, TEXT_ENCODING, LINE_END, tarArguments,
} from './keys.ts';
import { TEXT } from './text.ts';

const run = promisify(execFile);

export type GameFetcher = (out: string) => Promise<string>;

const fetchLatestGame: GameFetcher = async (out) => {
  const version = await latestVersion();
  console.log(TEXT.fetchingGame(version));
  await fetchOfficial({ version, out, jobs: FETCH_JOBS });
  const { missing } = findNames(out);
  if (missing.length) throw new Error(TEXT.gameNamesMissing(missing));
  return version;
};

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  Object.entries(values).reduce((text, [key, value]) => text.split(TEMPLATE_MARK(key)).join(value), template);

async function removeSourceMaps(folder: string): Promise<void> {
  for (const entry of await fs.readdir(folder, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(SOURCE_MAP_SUFFIX)) await fs.rm(path.join(entry.parentPath, entry.name));
  }
}

export type ServerRelease = Readonly<{ folder: string; archive: string }>;

export async function releaseServerEdition(edition: ServerEdition, { outRoot = path.join(REPO_ROOT, RELEASE_FOLDER), fetchGame = fetchLatestGame }: { outRoot?: string; fetchGame?: GameFetcher } = {}): Promise<ServerRelease> {
  const publicUrl = typeof edition.config.public_url === 'string' ? edition.config.public_url : '';
  if (!publicUrl) throw new Error(TEXT.needsPublicUrl);
  const domain = new URL(publicUrl).hostname;
  const parent = path.join(outRoot, edition.name);
  const folder = path.join(parent, edition.name);
  await fs.rm(parent, { recursive: true, force: true });
  const { webPage } = await buildServerEdition(edition, folder);
  await removeSourceMaps(webPage);
  for (const empty of SERVER_EMPTY_FOLDERS) await fs.mkdir(path.join(folder, empty), { recursive: true });
  const gameStep = edition.includeGame ? TEXT.gameIncluded(await fetchGame(path.join(folder, GAME_FOLDER))) : TEXT.gameToCopy;
  const values = {
    [TEMPLATE_KEY.title]: edition.title, [TEMPLATE_KEY.name]: edition.name, [TEMPLATE_KEY.domain]: domain,
    [TEMPLATE_KEY.cloudflareRanges]: CLOUDFLARE_RANGES.join(RANGE_SEPARATOR), [TEMPLATE_KEY.gameStep]: gameStep,
  };
  for (const file of SERVER_TEMPLATE_FILES) {
    const template = await fs.readFile(path.join(REPO_ROOT, ...SERVER_TEMPLATES_FOLDER, file), TEXT_ENCODING);
    await fs.writeFile(path.join(folder, file), fill(template, values));
  }
  await fs.writeFile(path.join(folder, SERVER_EXAMPLE_FILE), JSON.stringify(edition.config, null, JSON_INDENT) + LINE_END);
  const archive = path.join(parent, edition.name + ARCHIVE_EXTENSION);
  await run(TAR_COMMAND, tarArguments(archive, parent, edition.name));
  return { folder, archive };
}
