import { print, type Segment } from '../ui/log.ts';
import { COLOR } from '../core/keys.ts';
import { ALIASES, keysOn, specOf, resolveKey, aliasesOf, keyClientOnly, affectsGame, describeKey, showValue, type SettingKey, type SettingSpec } from '../state/schema.ts';
import { isFeatureOn } from '../../flags.ts';
import { settings } from '../state/store.ts';
import { findCommand, findSubcommand, findSubcommandAnywhere, helpEntries, findHelpEntry, type CommandDefinition, type CommandHelp, type HelpEntry } from './registry.ts';
import { ARG_WIDTH, EXAMPLE_WIDTH, NEAR_SHOWN, USAGE_WIDTH } from './constants.ts';
import { BOOL_TYPE, HELP_COMMAND, INT_TYPE, KEY_JOIN, KEY_TYPE, SOURCE_DEFAULT, SOURCE_YOURS, WHITESPACE } from './keys.ts';
import { HELP_TEXT as TEXT, REGISTRY_TEXT } from './text.ts';

export const CLIENT_TAG: Segment = [TEXT.clientTag, COLOR.warn, true];
const clientOnlyLine = (reason: string): void => { print([[TEXT.clientOnlyLine(reason), COLOR.warn, true]]); };

export function printPair(left: string, right: string | undefined, width: number): void {
  const indented = TEXT.indent(left);
  if (!right) {
    print(indented, COLOR.bright);
    return;
  }
  if (indented.length < width) {
    print([[indented.padEnd(width + 1), COLOR.bright], [right, COLOR.hint]]);
    return;
  }
  print(indented, COLOR.bright);
  print(TEXT.deepIndent(right), COLOR.hint);
}

function printSections(help: CommandHelp): void {
  for (const line of help.about ?? []) print(TEXT.indent(line));
  if (help.args) {
    print(TEXT.arguments, COLOR.title);
    for (const [argument, what] of help.args) printPair(argument, what, ARG_WIDTH);
  }
  if (help.examples) {
    print(TEXT.examples, COLOR.title);
    for (const [example, what] of help.examples) printPair(example, what, EXAMPLE_WIDTH);
  }
  for (const line of help.notes ?? []) print([[TEXT.indent(line), COLOR.hint, true]]);
  const related = (help.see ?? []).filter((word) => findCommand(word.split(WHITESPACE)[0]) !== undefined || resolveKey(word) !== null);
  if (related.length) print(TEXT.related(related), COLOR.hint);
}

function printEntry(entry: HelpEntry | undefined): void {
  if (!entry) return;
  const { def: definition, also } = entry;
  if (definition.renderHelp) {
    definition.renderHelp();
    return;
  }
  print(definition.usage, COLOR.title);
  print(TEXT.indent(definition.desc ?? ''));
  if (also.length) print(TEXT.also(also), COLOR.hint);
  if (typeof definition.clientOnly === 'string') clientOnlyLine(definition.clientOnly);
  printSections(definition.help ?? {});
}

function rangeOf(spec: SettingSpec): string {
  if (spec.type === BOOL_TYPE) return TEXT.onOff;
  if (spec.type === KEY_TYPE) return TEXT.keyName;
  const kind = spec.type === INT_TYPE ? TEXT.wholeNumber : TEXT.number;
  return kind + (spec.min === undefined ? '' : TEXT.range(spec.min, spec.max));
}

function printKeyHelp(key: SettingKey): void {
  const spec: SettingSpec | undefined = specOf(key);
  if (!spec) return;
  print(TEXT.keyUsage(key), COLOR.title);
  print(TEXT.indent(describeKey(key)));
  print(TEXT.keyGroup(spec.group, rangeOf(spec), spec.default === undefined ? '' : TEXT.defaultIs(showValue(key, spec.default))), COLOR.hint);
  const isSet = settings.has(key);
  const from = settings.source(key);
  const yours = settings.hasOwn(key) ? TEXT.yoursValue(showValue(key, settings.own(key))) : '';
  const via = from === SOURCE_YOURS || from === SOURCE_DEFAULT ? '' : TEXT.profileVia(from, yours);
  print(TEXT.now(isSet ? showValue(key, settings.get(key)) : TEXT.defaultWord, via), isSet ? COLOR.ok : undefined);
  const also = aliasesOf(key);
  if (also.length) print(TEXT.also(also), COLOR.hint);
  const reason = keyClientOnly(key);
  if (reason) clientOnlyLine(reason);
  for (const line of spec.about ?? []) print(TEXT.indent(line));
  print(TEXT.examples, COLOR.title);
  const example = spec.type === BOOL_TYPE ? TEXT.onWord : spec.example || TEXT.valuePlaceholder;
  printPair(TEXT.exampleOf(key, example), TEXT.setIt, EXAMPLE_WIDTH);
  if (spec.type === BOOL_TYPE) printPair(key, TEXT.toggleIt, EXAMPLE_WIDTH);
  printPair(TEXT.unsetExample(key), TEXT.backToDefault, EXAMPLE_WIDTH);
  if (affectsGame(key)) print([[TEXT.appliesInLevel, COLOR.hint, true]]);
}

export function printTopicHelp(raw: string): void {
  const words = raw.trim().toLowerCase().split(WHITESPACE);
  const [first = '', second] = words;
  const command = findCommand(first);
  let entry: HelpEntry | undefined;
  if (command && command.subcommands.length && second) {
    const subcommand = findSubcommand(command, second);
    if (!subcommand) throw new Error(TEXT.noSubcommandHelp(raw, command.name));
    entry = findHelpEntry(REGISTRY_TEXT.subcommandId(command.name, subcommand.name));
  } else if (words.length === 1 && !command) {
    const found = findSubcommandAnywhere(first);
    if (found) entry = findHelpEntry(REGISTRY_TEXT.subcommandId(found.cmd.name, found.sub.name));
  }
  if (entry) {
    printEntry(entry);
    return;
  }
  if (command && words.length === 1) {
    printEntry(findHelpEntry(command.name));
    return;
  }
  const key = resolveKey(words.join(KEY_JOIN)) ?? resolveKey(first);
  if (key) {
    printKeyHelp(key);
    return;
  }
  if (command) {
    printEntry(findHelpEntry(command.name));
    return;
  }
  const near = [...helpEntries().map((helpEntry) => helpEntry.id), ...keysOn(), ...Object.keys(ALIASES).filter((alias) => resolveKey(alias) !== null)]
    .filter((name) => name.includes(first) || first.includes(name)).slice(0, NEAR_SHOWN);
  throw new Error(TEXT.noHelp(raw, near));
}

function printOverview(): void {
  print(TEXT.commandsTitle, COLOR.title);
  for (const { def: definition } of helpEntries()) {
    const line: Segment[] = [[TEXT.overviewLine(definition.usage ?? '', definition.desc ?? '', USAGE_WIDTH)]];
    if (typeof definition.clientOnly === 'string') line.push(CLIENT_TAG);
    print(line);
  }
  const keys = keysOn();
  print(TEXT.keysTitle, COLOR.title);
  print(TEXT.keysLine(keys));
  print([[TEXT.clientOnlyCount(keys.filter(keyClientOnly).length, keys.length), COLOR.warn, true]]);
  print([[TEXT.clientOnlyMeaning, COLOR.warn, true]]);
  for (const { feature, line } of TEXT.quickExamples) if (isFeatureOn(feature)) print(line, COLOR.hint);
  print(TEXT.savedTo, COLOR.hint);
  print(TEXT.moreHelp, COLOR.title);
}

export const helpCommand: CommandDefinition = {
  name: HELP_COMMAND.name,
  aliases: [HELP_COMMAND.alias],
  usage: TEXT.usage,
  desc: TEXT.description,
  handlesHelp: true,
  help: { about: TEXT.about, examples: TEXT.helpExamples },
  run: (_args, { rest }) => {
    if (rest) printTopicHelp(rest);
    else printOverview();
  },
};
