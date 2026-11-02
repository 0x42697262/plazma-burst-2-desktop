import fs from 'node:fs/promises';
import path from 'node:path';
import type * as esbuild from 'esbuild';
import type { Edition, EditionDefaults } from '#shared/editions/types.ts';
import { CAPABILITIES } from '#shared/features/catalog.ts';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import {
  CAPABILITY_IMPORT, DEFAULTS_MODULE, EDITION_MODULE, EDITION_PLUGIN_NAME, FEATURES_FOLDER, FEATURE_IMPORT, featureCapabilityListFilter, FEATURE_LIST_MODULES, LINE_BREAK, LIST_ENTRY, PACKAGED_ROOT_MODULE, ROOT_MODULE, ROOT_PLUGIN_NAME,
  TYPESCRIPT_LOADER, exactPathFilter, wholeWord,
} from './constants.ts';
import { TEXT } from './text.ts';
import { NO_DEFAULTS } from './edition-defaults.ts';

const exactFile = (relative: string): RegExp => exactPathFilter(path.join(REPO_ROOT, relative));

export function onlyEditionFeatures(source: string, included: readonly string[], file: string, idOf: (match: RegExpExecArray) => string = (match) => match[2] ?? '', pattern: RegExp = FEATURE_IMPORT): string {
  const leftOut = new Set<string>();
  const kept = source.split(LINE_BREAK).filter((line) => {
    const imported = pattern.exec(line);
    if (!imported) return true;
    const [, name] = imported;
    if (included.includes(idOf(imported))) return true;
    leftOut.add(name ?? '');
    return false;
  }).filter((line) => !leftOut.has(LIST_ENTRY.exec(line)?.[1] ?? ''));
  const result = kept.join(LINE_BREAK);
  for (const name of leftOut) if (wholeWord(name).test(result)) throw new Error(TEXT.stillUsed(file, name));
  return result;
}

export function editionPlugin(edition: Edition, defaults: EditionDefaults = NO_DEFAULTS): esbuild.Plugin {
  return {
    name: EDITION_PLUGIN_NAME,
    setup(build) {
      build.onLoad({ filter: exactFile(EDITION_MODULE) }, () => ({ contents: TEXT.editionModule(JSON.stringify(edition)), loader: TYPESCRIPT_LOADER }));
      build.onLoad({ filter: exactFile(DEFAULTS_MODULE) }, () => ({ contents: TEXT.defaultsModule(JSON.stringify(defaults)), loader: TYPESCRIPT_LOADER }));
      const included = edition.features;
      const capabilities = edition.capabilities;
      if (capabilities !== null && capabilities !== undefined) {
        build.onLoad({ filter: featureCapabilityListFilter(path.join(REPO_ROOT, ...FEATURES_FOLDER)) }, async (args) => {
          const feature = path.basename(path.dirname(args.path));
          const source = await fs.readFile(args.path, 'utf8');
          const keptModules = CAPABILITIES.filter((capability) => capability.feature === feature && capabilities.includes(capability.id)).map((capability) => capability.module);
          return { contents: onlyEditionFeatures(source, keptModules, args.path, (match) => match[2] ?? '', CAPABILITY_IMPORT), loader: TYPESCRIPT_LOADER };
        });
      }
      if (included === null) return;
      for (const list of FEATURE_LIST_MODULES) {
        build.onLoad({ filter: exactFile(list) }, async (args) => ({
          contents: onlyEditionFeatures(await fs.readFile(args.path, 'utf8'), included, list),
          loader: TYPESCRIPT_LOADER,
        }));
      }
    },
  };
}

export const packagedRootPlugin = (): esbuild.Plugin => ({
  name: ROOT_PLUGIN_NAME,
  setup(build) {
    build.onLoad({ filter: exactFile(ROOT_MODULE) }, () => ({ contents: PACKAGED_ROOT_MODULE, loader: TYPESCRIPT_LOADER }));
  },
});
