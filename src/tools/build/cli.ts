import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { buildAll, watchAll } from './build.ts';
import { EDITION_FLAG, FEATURES_FLAG, FEATURE_LIST_SEPARATOR, FAILED_EXIT_CODE, WATCH_FLAG } from './constants.ts';
import { oneOffEdition, readEdition, readyEdition, type BuiltEdition } from './edition-file.ts';
import { createProbe } from '#features/server_list/adapters/probe.ts';
import { TEXT } from './text.ts';

const valueAfter = (flag: string): string | null => {
  const at = process.argv.indexOf(flag);
  return at < 0 ? null : process.argv[at + 1] ?? '';
};

function chosenEdition(): BuiltEdition | null {
  const name = valueAfter(EDITION_FLAG);
  if (name !== null) return readEdition(name);
  const list = valueAfter(FEATURES_FLAG);
  return list === null ? null : oneOffEdition(list.split(FEATURE_LIST_SEPARATOR).filter(Boolean));
}

async function main(): Promise<void> {
  if (process.argv.includes(WATCH_FLAG)) {
    await watchAll();
    console.log(TEXT.watching);
    return;
  }
  const built = chosenEdition();
  const chosen = built ? await readyEdition(built, (host, port) => createProbe().fingerprint(host, port)) : null;
  if (chosen?.problems.length) {
    console.error(TEXT.editionProblems(chosen.edition.name, chosen.problems));
    if (chosen.missing.length) console.error(TEXT.addThese(chosen.missing));
    process.exitCode = FAILED_EXIT_CODE;
    return;
  }
  if (chosen) {
    console.log(TEXT.edition(chosen.edition.name, chosen.edition.features ?? [], chosen.edition.capabilities));
  }
  for (const output of await buildAll(chosen?.edition, chosen?.defaults)) console.log(TEXT.built(path.relative(REPO_ROOT, output)));
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = FAILED_EXIT_CODE;
});
