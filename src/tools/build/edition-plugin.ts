import fs from 'node:fs/promises';
import path from 'node:path';
import type * as esbuild from 'esbuild';
import type { Edition } from '#shared/editions/types.ts';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import {
  EDITION_MODULE, EDITION_PLUGIN_NAME, FEATURE_IMPORT, FEATURE_LIST_MODULES, LINE_BREAK, LIST_ENTRY, PACKAGED_ROOT_MODULE, ROOT_MODULE, ROOT_PLUGIN_NAME,
  TYPESCRIPT_LOADER, exactPathFilter, wholeWord,
} from './constants.ts';
import { TEXT } from './text.ts';

const exactFile = (relative: string): RegExp => exactPathFilter(path.join(REPO_ROOT, relative));

export function onlyEditionFeatures(source: string, included: readonly string[], file: string): string {
  const leftOut = new Set<string>();
  const kept = source.split(LINE_BREAK).filter((line) => {
    const imported = FEATURE_IMPORT.exec(line);
    if (!imported) return true;
    const [, name, featureId] = imported;
    if (included.includes(featureId ?? '')) return true;
    leftOut.add(name ?? '');
    return false;
  }).filter((line) => !leftOut.has(LIST_ENTRY.exec(line)?.[1] ?? ''));
  const result = kept.join(LINE_BREAK);
  for (const name of leftOut) if (wholeWord(name).test(result)) throw new Error(TEXT.stillUsed(file, name));
  return result;
}

export function editionPlugin(edition: Edition): esbuild.Plugin {
  return {
    name: EDITION_PLUGIN_NAME,
    setup(build) {
      build.onLoad({ filter: exactFile(EDITION_MODULE) }, () => ({ contents: TEXT.editionModule(JSON.stringify(edition)), loader: TYPESCRIPT_LOADER }));
      const included = edition.features;
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
