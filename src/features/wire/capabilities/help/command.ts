import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { FIELD_DEFAULT_WIDTH, FIELD_NAME_WIDTH, FIELD_TYPE_WIDTH } from '../../constants.ts';
import { COMMAND, OTHER_CLIENTS } from '../../keys.ts';
import { WIRE_TEXT } from '../../text.ts';
import { resolveMessage } from '../../domain/parse.ts';
import { DESCRIPTIONS, EXAMPLES } from '../../domain/constants.ts';
import type { Field } from '../../domain/types.ts';
import { DEFAULT_WORDS, HELP_TEXT as TEXT, KIND_WORDS } from './text.ts';

const kindOf = (field: Field): string => KIND_WORDS[field.kind] ?? field.kind;
const typeOf = (field: Field): string => (field.scale === undefined ? kindOf(field) : TEXT.scaled(kindOf(field), field.scale));
const defaultOf = (field: Field): string => (field.default === undefined ? TEXT.required : DEFAULT_WORDS[field.default] ?? field.default);
const meaningOf = (field: Field): string => field.desc + (field.choices ? TEXT.choices(field.choices) : '');

function printRow(name: string, type: string, byDefault: string, meaning: string, color?: string): void {
  print(TEXT.columns(name.padEnd(FIELD_NAME_WIDTH), type.padEnd(FIELD_TYPE_WIDTH), byDefault.padEnd(FIELD_DEFAULT_WIDTH), meaning), color);
}

const printField = (field: Field): void => { printRow(field.name, typeOf(field), defaultOf(field), meaningOf(field)); };

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
    printRow(TEXT.columnName, TEXT.columnType, TEXT.columnDefault, TEXT.columnMeaning, COLOR.muted);
  }
  for (const field of message.fields) printField(field);
  if (message.group) {
    print(TEXT.groupHeading, COLOR.muted);
    for (const field of message.group) printField(field);
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
