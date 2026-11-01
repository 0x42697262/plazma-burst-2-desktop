import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { clientFor, withoutClientFlag } from '#kernel/config/clients.ts';
import { FAILED_EXIT_CODE, FIRST_USER_ARGUMENT, JSON_INDENT, DATE_LENGTH, OK } from './constants.ts';
import { ARG, CONTENT_TYPE, CONTENT_TYPE_HEADER, FORM_TYPE, LISTS_URL, POST_METHOD, SCRIPT_TYPE, SERVER_LISTS, SOURCE_URL, TEXT_ENCODING, USER_AGENT, USER_AGENT_HEADER, listsRequest } from './keys.ts';
import { TEXT } from './text.ts';
import { check, parseCategories, parseMarkPairs, parseParamTable, parseParams, type Table } from './parse.ts';

function render(table: Table, source: string): string {
  const data = { source, fetched: new Date().toISOString().slice(0, DATE_LENGTH), ...table };
  const ordered = { source: data.source, fetched: data.fetched, aliases: data.aliases, actions: data.actions, params: data.params, values: data.values, categories: data.categories, markPairs: data.markPairs };
  return TEXT.fileHeader + TEXT.fileBody(JSON.stringify(ordered, null, JSON_INDENT));
}

async function fetchServerLists(): Promise<Record<string, Record<string, string>>> {
  const lists: Record<string, Record<string, string>> = {};
  for (const kind of SERVER_LISTS) {
    try {
      const response = await fetch(LISTS_URL, {
        method: POST_METHOD,
        headers: { [USER_AGENT_HEADER]: USER_AGENT, [CONTENT_TYPE_HEADER]: FORM_TYPE },
        body: listsRequest(kind),
      });
      if (response.status !== OK) throw new Error(TEXT.httpStatus(response.status));
      const list = parseParamTable(await response.text()).values[kind];
      if (!list) throw new Error(TEXT.noValues);
      lists[kind] = list;
    } catch (error) {
      console.warn(TEXT.listNotFetched(kind, (error as Error).message));
    }
  }
  return lists;
}

async function readSource(from: string | null, sourceUrl: string): Promise<string> {
  if (from) return fs.readFileSync(from, TEXT_ENCODING);
  const response = await fetch(sourceUrl, { headers: { [USER_AGENT_HEADER]: USER_AGENT } });
  if (response.status !== OK) throw new Error(TEXT.sourceStatus(sourceUrl, response.status));
  if (!SCRIPT_TYPE.test(response.headers.get(CONTENT_TYPE) || '')) throw new Error(TEXT.notAScript(sourceUrl));
  return response.text();
}

async function main(): Promise<void> {
  const client = clientFor();
  const args = withoutClientFlag(process.argv.slice(FIRST_USER_ARGUMENT));
  const sourceUrl = client.editorScript || SOURCE_URL;
  let from: string | null = null;
  let out = client.opcodes;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === ARG.from) from = args[++index] ?? null;
    else if (arg === ARG.out) out = path.resolve(args[++index] ?? '');
    else if (arg === ARG.help || arg === ARG.helpShort) {
      console.log(TEXT.usage);
      return;
    } else throw new Error(TEXT.unknownArgument(arg ?? ''));
  }
  const source = await readSource(from, sourceUrl);
  const paramTable = parseParamTable(source);
  const table: Table = { ...parseParams(source), ...paramTable };
  if (!from && !client.editorScript) Object.assign(paramTable.values, await fetchServerLists());
  table.categories = parseCategories(source);
  table.markPairs = parseMarkPairs(source);
  const problems = check(table);
  if (problems.length) {
    for (const problem of problems) console.error(TEXT.problem(problem));
    throw new Error(TEXT.notWritten(out));
  }
  fs.writeFileSync(out, render(table, from ? path.basename(from) : sourceUrl));
  console.log(TEXT.found(Object.keys(table.actions).length, Object.keys(table.aliases).length, paramTable.params.length, Object.keys(paramTable.values).length, path.relative(REPO_ROOT, out)));
}

main().catch((error: unknown) => {
  console.error(TEXT.failed((error as Error).message));
  process.exit(FAILED_EXIT_CODE);
});
