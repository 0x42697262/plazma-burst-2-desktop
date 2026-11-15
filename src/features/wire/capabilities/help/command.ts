import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { FIELD_DEFAULT_WIDTH, FIELD_NAME_WIDTH, FIELD_TYPE_WIDTH } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { resolveMessage } from '../../domain/parse.ts';
import type { Field } from '../../domain/types.ts';
import { HELP_TEXT as TEXT } from './text.ts';

const typeOf = (field: Field): string => (field.scale === undefined ? field.kind : TEXT.scaled(field.scale));

function printField(field: Field): void {
  print(TEXT.field(field.name.padEnd(FIELD_NAME_WIDTH), typeOf(field).padEnd(FIELD_TYPE_WIDTH), String(field.default ?? '').padEnd(FIELD_DEFAULT_WIDTH), field.desc));
}

function wireHelp(args: string[]): void {
  const message = resolveMessage(args[0] ?? '');
  print(TEXT.heading(message.name.toLowerCase(), message.direction), COLOR.title);
  if (message.note) print(TEXT.noteLine(message.note), COLOR.muted);
  for (const field of message.fields) printField(field);
  if (message.group) {
    print(TEXT.groupHeading, COLOR.muted);
    for (const field of message.group) printField(field);
  }
}

export const helpCommand = Object.freeze({
  parent: COMMAND.name, name: COMMAND.help, capability: CAPABILITY.wire.help,
  usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about, see: TEXT.see }, run: wireHelp,
});
