import { print, type Segment } from '../ui/log.ts';
import { COLOR } from '../core/keys.ts';
import { SCHEMA, specOf, groupsOn, isKeyOn, resolveKey, parseValue, affectsGame, keyClientOnly, describeKey, showValue, type SettingKey, type SettingSpec } from '../state/schema.ts';
import { settings } from '../state/store.ts';
import { levelWasActive } from '../overrides/frame.ts';
import { gameMaxHp } from '../overrides/max-hp.ts';
import { heldBack, refusal } from '../overrides/server-checks.ts';
import { listSections, type ListSection } from '../list-sections.ts';
import { checksBypassed } from '../danger/bypass.ts';
import { CLIENT_TAG } from './help.ts';
import type { CommandDefinition } from './registry.ts';
import { KEY_SETTING_ARGUMENT, KEY_WIDTH, SET_KEY_ARGUMENT, VALUE_WIDTH } from './constants.ts';
import { BOOL_TYPE, CHECKS_SECTION, KEY_TYPE, RESET_WORDS, SETTINGS_COMMAND, SOURCE_DEFAULT, SOURCE_YOURS } from './keys.ts';
import { SETTINGS_TEXT as TEXT } from './text.ts';

const shown = (key: string): string => (settings.has(key) ? showValue(key, settings.get(key)) : TEXT.defaultWord);

export function sourceTag(key: string): string {
  const from = settings.source(key);
  if (from === SOURCE_YOURS || from === SOURCE_DEFAULT) return '';
  return TEXT.profileTag(from, settings.hasOwn(key) ? TEXT.yoursTag(showValue(key, settings.own(key))) : '');
}

function profileWins(key: string): void {
  const from = settings.source(key);
  if (from === SOURCE_YOURS || from === SOURCE_DEFAULT) return;
  print(TEXT.profileWins(from, key, showValue(key, settings.get(key))), COLOR.warn);
}

function requireKey(word: string | undefined): SettingKey {
  const key = resolveKey(word);
  if (!key) throw new Error(TEXT.unknownKey(word ?? ''));
  return key;
}

export function setKey(key: string, raw: unknown): void {
  const value = parseValue(key, raw);
  const why = heldBack(key, value, gameMaxHp());
  if (why) throw refusal(TEXT.refusedWhat(key, showValue(key, value)), why);
  settings.set(key, value);
  print(TEXT.keyValue(key, showValue(key, value)), COLOR.ok);
  if (!levelWasActive() && affectsGame(key)) print(TEXT.appliesInLevel, COLOR.hint);
  profileWins(key);
}

export function unsetKey(key: string, note = ''): void {
  settings.unset(key);
  print(TEXT.defaultWithNote(key, note), COLOR.ok);
  profileWins(key);
}

export function runKey(key: string, args: readonly string[]): void {
  const [word] = args;
  if (word === undefined) {
    const spec: SettingSpec | undefined = (SCHEMA as Record<string, SettingSpec | undefined>)[key];
    if (spec?.type === BOOL_TYPE) setKey(key, settings.has(key) ? !settings.get(key) : !spec.default);
    else print(TEXT.keyValue(key, shown(key)));
  } else if (RESET_WORDS.includes(word.toLowerCase())) {
    unsetKey(key);
  } else {
    setKey(key, word);
  }
}

const EXTRAS: Readonly<Record<string, ListSection>> = Object.freeze({
  [CHECKS_SECTION]: () => checksBypassed() && [TEXT.checksTitle, [TEXT.checksRow]] as const,
});
const allExtras = (): Record<string, ListSection> => ({ ...EXTRAS, ...Object.fromEntries(listSections()) });
const listGroups = (): string[] => [...groupsOn(), ...Object.keys(allExtras())];

function listExtras(only?: string): void {
  for (const [name, make] of Object.entries(allExtras())) {
    if (only && name !== only) continue;
    const section = make();
    if (!section) {
      if (only) print(TEXT.nothingIn(name), COLOR.notice);
      continue;
    }
    print(TEXT.sectionTitle(section[0]), COLOR.title);
    for (const row of section[1]) print(row, COLOR.ok);
  }
}

function listKeys(group?: string): void {
  if (group && Object.hasOwn(allExtras(), group)) {
    listExtras(group);
    return;
  }
  const byGroup = new Map<string, string[]>();
  for (const [key, spec] of Object.entries(SCHEMA as Record<string, SettingSpec>)) {
    if (!isKeyOn(key) || (group && spec.group !== group)) continue;
    const keys = byGroup.get(spec.group) ?? [];
    keys.push(key);
    byGroup.set(spec.group, keys);
  }
  if (!byGroup.size) {
    print(TEXT.noGroup(group ?? '', listGroups()), COLOR.error);
    return;
  }
  for (const [groupName, keys] of byGroup) {
    print(TEXT.sectionTitle(groupName), COLOR.title);
    for (const key of keys) {
      const line: Segment[] = [[TEXT.keyRow(key, shown(key), describeKey(key), KEY_WIDTH, VALUE_WIDTH), settings.has(key) ? COLOR.ok : undefined]];
      const tag = sourceTag(key);
      if (tag) line.push([TEXT.tag(tag), COLOR.warn, true]);
      if (keyClientOnly(key)) line.push(CLIENT_TAG);
      print(line);
    }
  }
  if (!group) listExtras();
}

const keySettingArgument = (words: readonly string[]): number | undefined => {
  const key = resolveKey(words[1]);
  return key && specOf(key)?.type === KEY_TYPE ? SET_KEY_ARGUMENT : undefined;
};

export { KEY_SETTING_ARGUMENT };

export const settingsCommands: readonly CommandDefinition[] = [
  {
    name: SETTINGS_COMMAND.list,
    aliases: [SETTINGS_COMMAND.listAlias],
    usage: TEXT.list.usage,
    desc: TEXT.list.desc,
    help: {
      about: TEXT.list.about,
      get args() { return TEXT.list.groupArgument(listGroups()); },
      examples: TEXT.list.examples,
      see: TEXT.list.see,
    },
    run: (args) => { listKeys(args[0]); },
  },
  {
    name: SETTINGS_COMMAND.set,
    usage: TEXT.set.usage,
    keyArg: keySettingArgument,
    desc: TEXT.set.desc,
    clientOnly: (args) => {
      const key = resolveKey(args[0]);
      const reason = keyClientOnly(key);
      return reason && key ? [key, reason] : undefined;
    },
    help: { about: TEXT.set.about, args: TEXT.set.args, examples: TEXT.set.examples, notes: TEXT.set.notes, see: TEXT.set.see },
    run: (args) => {
      const key = requireKey(args[0]);
      if (args[1] === undefined) throw new Error(TEXT.setUsage(key));
      setKey(key, args[1]);
    },
  },
  {
    name: SETTINGS_COMMAND.get,
    usage: TEXT.get.usage,
    desc: TEXT.get.desc,
    help: { args: TEXT.get.args, examples: TEXT.get.examples, see: TEXT.get.see },
    run: (args) => {
      const key = requireKey(args[0]);
      print(TEXT.keyValueTagged(key, shown(key), sourceTag(key)));
    },
  },
  {
    name: SETTINGS_COMMAND.unset,
    aliases: SETTINGS_COMMAND.unsetAliases,
    usage: TEXT.unset.usage,
    desc: TEXT.unset.desc,
    help: { about: TEXT.unset.about, examples: TEXT.unset.examples, see: TEXT.unset.see },
    run: (args) => { unsetKey(requireKey(args[0])); },
  },
  {
    name: SETTINGS_COMMAND.reset,
    usage: TEXT.reset.usage,
    desc: TEXT.reset.desc,
    help: { about: TEXT.reset.about, see: TEXT.reset.see },
    run: () => {
      settings.clear();
      print(TEXT.allRemoved, COLOR.ok);
    },
  },
];
