import type { Channel, DefaultRule, FieldKind } from '../keys.ts';

export type Field = Readonly<{
  name: string;
  kind: FieldKind;
  scale?: number;
  default?: DefaultRule;
  choices?: readonly string[];
  desc: string;
}>;

export type Message = Readonly<{
  name: string;
  channel: Channel;
  sendable: boolean;
  reply: boolean;
  force?: boolean;
  direction: string;
  fields: readonly Field[];
  group?: readonly Field[];
  note?: string;
}>;
