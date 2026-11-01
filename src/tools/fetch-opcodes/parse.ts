import {
  ADD_TRIGGER, ANY_STRING, BACKSLASH, BACKTICK, BLOCK_COMMENT_END, BLOCK_COMMENT_START, CALL, CATEGORY_SEPARATOR, DEFAULT_COLOR, ENTITIES, ESCAPED_CHARACTER,
  FIRST_GROUP, HTML_TAG, INTEGER_TEXT, KNOWN_ALIASES, LINE_COMMENT, LIST_OF, MARK_PAIR, MARK_PREFIX, NAMED_ENTITY, NEWLINE, NUMERIC_ENTITY, PARAM, QUOTES,
  RAINBOW, REGION_ACTIVATION, SKY_MARK, VALUE,
} from './keys.ts';
import { MIN_ACTIONS, MIN_ALIASES, MIN_PARAMS } from './constants.ts';
import { TEXT } from './text.ts';

export type Action = { desc: string; a: string; b: string; alias?: string };
export type Param = { name: string; kind: string; title: string; desc: string; cls: string };
export type Category = { name: string; color: string };
export type Table = {
  actions: Record<number, Action>;
  aliases: Record<string, number>;
  params?: Param[];
  values?: Record<string, Record<string, string>>;
  categories?: Category[] | null;
  markPairs?: Record<string, string>;
};

const isCommentStart = (source: string, index: number, marker: string): boolean => source.startsWith(marker, index);

export function stripComments(source: string): string {
  let stripped = '';
  let quote: string | null = null;
  for (let index = 0; index < source.length; index++) {
    const character = source[index] ?? '';
    if (quote) {
      stripped += character;
      if (character === BACKSLASH) stripped += source[++index] ?? '';
      else if (character === quote || (character === NEWLINE && quote !== BACKTICK)) quote = null;
    } else if (isCommentStart(source, index, LINE_COMMENT)) {
      while (index < source.length && source[index] !== NEWLINE) index++;
      stripped += NEWLINE;
    } else if (isCommentStart(source, index, BLOCK_COMMENT_START)) {
      const end = source.indexOf(BLOCK_COMMENT_END, index + BLOCK_COMMENT_START.length);
      index = end < 0 ? source.length : end + 1;
    } else {
      if (QUOTES.includes(character)) quote = character;
      stripped += character;
    }
  }
  return stripped;
}

const unquote = (text: string): string => text.slice(1, -1).replace(ESCAPED_CHARACTER, FIRST_GROUP);
const plainText = (text: string): string => text.replace(HTML_TAG, '')
  .replace(NUMERIC_ENTITY, (entity, code: string) => ENTITIES[entity] ?? String.fromCharCode(Number(code)))
  .replace(NAMED_ENTITY, (entity) => ENTITIES[entity] ?? entity);
const propName = (quoted: string | undefined, bare: string | undefined): string => (quoted !== undefined ? unquote(quoted) : bare ?? '');

export function parseParams(source: string): Pick<Table, 'actions' | 'aliases'> {
  const actions: Record<number, Action> = {};
  let last: number | null = null;
  for (const match of stripComments(source).matchAll(CALL)) {
    if (match[1] === ADD_TRIGGER) {
      last = Number(match[2]);
      actions[last] = { desc: plainText(unquote(match[3] ?? '')), a: unquote(match[4] ?? ''), b: unquote(match[5] ?? '') };
    } else if (last !== null && actions[last]) {
      const action = actions[last];
      if (action) action.alias = unquote(match[6] ?? '');
    }
  }
  const aliases: Record<string, number> = {};
  for (const type of Object.keys(actions).map(Number).filter((number) => number >= 0).sort((first, second) => first - second)) {
    const alias = actions[type]?.alias;
    if (alias && !(alias in aliases)) aliases[alias] = type;
  }
  return { actions, aliases };
}

export function parseParamTable(source: string): { params: Param[]; values: Record<string, Record<string, string>> } {
  const code = stripComments(source);
  const params = [...code.matchAll(PARAM)].map((match) => ({
    name: unquote(match[1] ?? ''), kind: unquote(match[2] ?? ''), title: plainText(unquote(match[3] ?? '')), desc: plainText(unquote(match[4] ?? '')), cls: unquote(match[5] ?? ''),
  }));
  const values: Record<string, Record<string, string>> = {};
  for (const match of code.matchAll(VALUE)) {
    const kind = propName(match[1], match[2]);
    const written = match[3] ?? '';
    const key = INTEGER_TEXT.test(written) ? written : unquote(written);
    if (LIST_OF.test(key)) continue;
    (values[kind] ??= {})[key] = plainText(unquote(match[4] ?? ''));
  }
  return { params, values };
}

export function parseMarkPairs(source: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const match of stripComments(source).matchAll(MARK_PAIR)) {
    const key = propName(match[1], match[2]);
    if (key.startsWith(MARK_PREFIX)) pairs[key.slice(MARK_PREFIX.length)] = unquote(match[3] ?? '');
  }
  return pairs;
}

export function parseCategories(source: string): Category[] | null {
  const code = stripComments(source);
  const rainbowList = RAINBOW.exec(code)?.[1];
  const rainbow = rainbowList ? [...rainbowList.matchAll(ANY_STRING)].map((match) => unquote(match[0])) : [];
  const categories: Category[] = [];
  for (const call of code.matchAll(CALL)) {
    if (call[1] !== ADD_TRIGGER) continue;
    const parts = plainText(unquote(call[3] ?? '')).split(CATEGORY_SEPARATOR);
    const name = parts[0] ?? '';
    if (parts.length > 1 && !categories.some((category) => category.name === name)) categories.push({ name, color: rainbow[categories.length] || DEFAULT_COLOR });
  }
  return categories.length ? categories : null;
}

export function check({ actions, aliases, params, values, categories, markPairs }: Table): string[] {
  const problems: string[] = [];
  const actionCount = Object.keys(actions).length;
  if (actionCount < MIN_ACTIONS) problems.push(TEXT.fewActions(actionCount, MIN_ACTIONS));
  const aliasCount = Object.keys(aliases).length;
  if (aliasCount < MIN_ALIASES) problems.push(TEXT.fewAliases(aliasCount, MIN_ALIASES));
  if (params && params.length < MIN_PARAMS) problems.push(TEXT.fewParams(params.length, MIN_PARAMS));
  if (values && !values[REGION_ACTIVATION]) problems.push(TEXT.noRegionActivation);
  if (categories !== undefined && !categories) problems.push(TEXT.noCategories);
  if (markPairs && !markPairs[SKY_MARK]) problems.push(TEXT.noSkyMark);
  for (const [alias, type] of Object.entries(KNOWN_ALIASES)) {
    if (aliases[alias] !== type) problems.push(TEXT.wrongAlias(alias, aliases[alias], type));
  }
  return problems;
}
