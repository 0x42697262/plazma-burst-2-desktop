import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { z } from 'zod';
import { CATALOG, CATALOG_BY_ID } from '#shared/features/catalog.ts';
import { FEATURE, MODE, type FeatureId } from '#shared/features/keys.ts';
import type { Edition } from '#shared/editions/types.ts';
import { EDITIONS_DIR, REPO_ROOT } from '#kernel/config/paths.ts';
import { resolveEdition } from '#kernel/editions/resolve.ts';
import { checkConfig } from '#server/config.ts';
import { editionPlugin } from './edition-plugin.ts';
import { pageBuildOptions } from './build.ts';
import {
  EDITION_FILE_EXTENSION, EDITION_NAME_PATTERN, FILE_ENCODING, OPTIONAL_NATIVE_MODULES, ROOT_MODULE, SERVER_BUNDLE_PATH, SERVER_EDITION_KIND, SERVER_ENTRY, SERVER_ROOT_MODULE,
  SERVER_ROOT_PLUGIN_NAME, SERVER_TARGET, TYPESCRIPT_LOADER, WEB_PAGE_PATH, exactPathFilter, serverAppId,
} from './constants.ts';
import { TEXT } from './text.ts';

const partSchema = z.object({ features: z.array(z.string()) }).strict();

const serverEditionSchema = z.object({
  name: z.string().regex(EDITION_NAME_PATTERN),
  kind: z.literal(SERVER_EDITION_KIND),
  title: z.string().min(1),
  include_game: z.boolean(),
  server: partSchema,
  web: partSchema,
  config: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type ServerEdition = Readonly<{
  name: string;
  title: string;
  includeGame: boolean;
  server: Edition;
  web: Edition;
  config: Readonly<Record<string, unknown>>;
  problems: readonly string[];
}>;

const lobbyFeatureIds = (): FeatureId[] => CATALOG.filter((definition) => definition.availableIn.includes(MODE.lobby)).map((definition) => definition.id);

const needsTheConsole = (id: string): boolean => id === FEATURE.devConsole || (CATALOG_BY_ID.get(id as FeatureId)?.requires.includes(FEATURE.devConsole) ?? false);
const isPageFeature = (id: string): boolean => CATALOG_BY_ID.get(id as FeatureId)?.availableIn.includes(MODE.local) ?? false;

export function isServerEditionFile(name: string, folder: string = EDITIONS_DIR): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(folder, name + EDITION_FILE_EXTENSION), FILE_ENCODING)) as { kind?: unknown };
    return parsed.kind === SERVER_EDITION_KIND;
  } catch {
    return false;
  }
}

function partEdition(name: string, title: string, listed: readonly string[]): { edition: Edition; problems: readonly string[] } {
  const resolved = resolveEdition(CATALOG, listed);
  return { edition: Object.freeze({ name, title, appId: serverAppId(name), features: resolved.features, capabilities: resolved.capabilities }), problems: resolved.problems };
}

export function readServerEdition(name: string, folder: string = EDITIONS_DIR): ServerEdition {
  const file = path.join(folder, name + EDITION_FILE_EXTENSION);
  const shown = path.relative(REPO_ROOT, file);
  let parsed: z.infer<typeof serverEditionSchema>;
  try {
    parsed = serverEditionSchema.parse(JSON.parse(fs.readFileSync(file, FILE_ENCODING)));
  } catch (error) {
    throw new Error(TEXT.editionUnreadable(shown, (error as Error).message), { cause: error });
  }
  if (parsed.name !== name) throw new Error(TEXT.nameMismatch(shown, parsed.name));
  const lobby = lobbyFeatureIds();
  const server = partEdition(parsed.name, parsed.title, parsed.server.features);
  const web = partEdition(parsed.name, parsed.title, parsed.web.features);
  const config = parsed.config ?? {};
  const configErrors = checkConfig(config).errors;
  const problems = [
    ...server.problems,
    ...parsed.server.features.filter((id) => !lobby.includes(id as FeatureId)).map((id) => TEXT.notLobbyFeature(id, lobby)),
    ...web.problems,
    ...(web.edition.features ?? []).filter((id) => needsTheConsole(id) || !isPageFeature(id)).map(TEXT.notWebFeature),
    ...(configErrors.length ? [TEXT.badServerConfig(configErrors)] : []),
  ];
  return Object.freeze({ name: parsed.name, title: parsed.title, includeGame: parsed.include_game, server: server.edition, web: web.edition, config, problems: [...new Set(problems)] });
}

export function withPublicUrl(edition: ServerEdition, publicUrl: string | null): ServerEdition {
  if (publicUrl === null) return edition;
  const config = { ...edition.config, public_url: publicUrl };
  const errors = checkConfig(config).errors;
  return Object.freeze({ ...edition, config, problems: errors.length ? [...edition.problems, TEXT.badServerConfig(errors)] : edition.problems });
}

const serverRootPlugin = (): esbuild.Plugin => ({
  name: SERVER_ROOT_PLUGIN_NAME,
  setup(build) {
    build.onLoad({ filter: exactPathFilter(path.join(REPO_ROOT, ROOT_MODULE)) }, () => ({ contents: SERVER_ROOT_MODULE, loader: TYPESCRIPT_LOADER }));
  },
});

export const serverBundleOptions = (outfile: string, edition: Edition): esbuild.BuildOptions => ({
  bundle: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [editionPlugin(edition), serverRootPlugin()],
  entryPoints: [path.join(REPO_ROOT, SERVER_ENTRY)],
  outfile,
  format: 'cjs',
  platform: 'node',
  target: SERVER_TARGET,
  external: [...OPTIONAL_NATIVE_MODULES],
});

export type ServerBuild = Readonly<{ serverBundle: string; webPage: string }>;

export async function buildServerEdition(edition: ServerEdition, outRoot: string): Promise<ServerBuild> {
  const serverBundle = path.join(outRoot, ...SERVER_BUNDLE_PATH);
  const webPage = path.join(outRoot, ...WEB_PAGE_PATH);
  await fsp.rm(webPage, { recursive: true, force: true });
  await Promise.all([
    esbuild.build(serverBundleOptions(serverBundle, edition.server)),
    esbuild.build(pageBuildOptions(webPage, edition.web)),
  ]);
  return { serverBundle, webPage };
}
