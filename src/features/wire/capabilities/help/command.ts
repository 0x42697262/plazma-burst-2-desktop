import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { FIELD_DEFAULT_WIDTH, FIELD_NAME_WIDTH, FIELD_TYPE_WIDTH, FIELD_VALUES_WIDTH } from '../../constants.ts';
import { COMMAND, DEFAULT_RULE, OTHER_CLIENTS } from '../../keys.ts';
import { WIRE_TEXT } from '../../text.ts';
import { resolveMessage } from '../../domain/parse.ts';
import { DESCRIPTIONS, EXAMPLES } from '../../domain/constants.ts';
import type { Field } from '../../domain/types.ts';
import { DEFAULT_WORDS, HELP_TEXT as TEXT, KIND_WORDS, VALUE_BY_KIND, VALUE_HINTS, hintKey } from './text.ts';
import type { Message } from '../../domain/types.ts';

const kindOf = (field: Field): string => KIND_WORDS[field.kind] ?? field.kind;
const typeOf = (field: Field): string => (field.scale === undefined ? kindOf(field) : TEXT.scaled(kindOf(field), field.scale));
const defaultOf = (field: Field): string => (field.default === undefined ? TEXT.required : DEFAULT_WORDS[field.default] ?? field.default);
const AUTOMATIC: ReadonlySet<string | undefined> = new Set([DEFAULT_RULE.targetRespawns, DEFAULT_RULE.replyId]);

const valuesOf = (message: Message, field: Field): string => VALUE_HINTS[hintKey(message.name, field.name)]
  ?? (AUTOMATIC.has(field.default) ? TEXT.leaveOut : undefined)
  ?? (field.choices ? field.choices.join(TEXT.choiceSeparator) : VALUE_BY_KIND[field.kind] ?? '');

function printRow(name: string, type: string, byDefault: string, values: string, meaning: string, color?: string): void {
  print(TEXT.columns(name.padEnd(FIELD_NAME_WIDTH), type.padEnd(FIELD_TYPE_WIDTH), byDefault.padEnd(FIELD_DEFAULT_WIDTH), values.padEnd(FIELD_VALUES_WIDTH), meaning), color);
}

const printField = (message: Message, field: Field): void => { printRow(field.name, typeOf(field), defaultOf(field), valuesOf(message, field), field.desc); };

function wireHelp(args: string[]): void {
  const message = resolveMessage(args[0] ?? '');
  const hasFields = message.fields.length > 0 || (message.group?.length ?? 0) > 0;
  const fields = [...message.fields, ...(message.group ?? [])];
  print(TEXT.heading(message.name.toLowerCase(), message.direction), COLOR.title);
  const description = DESCRIPTIONS[message.name];
  if (description) print(TEXT.description(description));
  if (message.note) print(TEXT.noteLine(message.note), COLOR.muted);
  if (hasFields) {
    print(TEXT.setHint, COLOR.muted);
    printRow(TEXT.columnName, TEXT.columnType, TEXT.columnDefault, TEXT.columnExample, TEXT.columnMeaning, COLOR.muted);
  }
  for (const field of message.fields) printField(message, field);
  if (message.group) {
    print(TEXT.groupHeading, COLOR.muted);
    for (const field of message.group) printField(message, field);
  }
  if (fields.some((field) => field.scale !== undefined)) print(TEXT.units, COLOR.muted);
  const example = EXAMPLES[message.name];
  if (example) print(WIRE_TEXT.exampleLine(example), COLOR.ok);
  if (message.direction.includes(OTHER_CLIENTS)) print(WIRE_TEXT.otherClientsNote, COLOR.muted);
}

export const helpCommand = Object.freeze({
  parent: COMMAND.name, name: COMMAND.help, capability: CAPABILITY.wire.help,
  usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about, see: TEXT.see }, run: wireHelp,
});
