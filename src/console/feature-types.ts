import type { KeySpec } from './kernel/state/schema.ts';
import type { MovingCharacter } from './kernel/game/types.ts';
import { isCapabilityOn } from './flags.ts';
import { REGISTRY_TEXT as TEXT } from './kernel/commands/text.ts';
import type { FeatureId } from '#shared/features/keys.ts';

export type CommandDefinition = Readonly<{ name: string; capability?: string; [field: string]: unknown }>;
export type FrameHook = Readonly<{ name: string; run(): void }>;
export type OverrideContext = Readonly<{ character: MovingCharacter; running: boolean; tick: number }>;
export type FrameOverride = Readonly<{ name: string; capability?: string; apply(context: OverrideContext): void; cleanup(): void }>;
export type ConsoleTick = Readonly<{ name: string; everyMs: number; errorsShown: number; run(): void }>;

import type { ListSection } from './kernel/list-sections.ts';

export type ConsoleFeature = Readonly<{
  id: FeatureId;
  commands?: readonly CommandDefinition[];
  frame?: readonly FrameHook[];
  overrides?: readonly FrameOverride[];
  settings?: Readonly<Record<string, KeySpec>>;
  ticks?: readonly ConsoleTick[];
  listSections?: Readonly<Record<string, ListSection>>;
  start?(): void;
}>;

export type PartCommand = Readonly<{ name?: string; capability?: string; parent?: string; ownRun?: boolean; [field: string]: unknown }>;
export type CommandShell = Readonly<{ name: string; aliases?: readonly string[]; [field: string]: unknown }>;
export type CapabilityParts = Readonly<{
  capability: string;
  commands?: readonly PartCommand[];
  overrides?: readonly FrameOverride[];
  settings?: Readonly<Record<string, KeySpec>>;
  listSections?: Readonly<Record<string, ListSection>>;
  start?(): void;
}>;

type ConsoleFeatureExtra = Omit<ConsoleFeature, 'id' | 'overrides' | 'settings'> & Readonly<{ shells?: readonly CommandShell[] }>;

function assemble(shells: readonly CommandShell[], tagged: readonly PartCommand[]): CommandDefinition[] {
  return shells.flatMap((shell): CommandDefinition[] => {
    const own = tagged.find((command) => command.parent === shell.name && command.ownRun);
    const subcommands = tagged.filter((command) => command.parent === shell.name && !command.ownRun).map(({ parent: _parent, ownRun: _ownRun, ...subcommand }) => subcommand);
    if (!own && !subcommands.length) return [];
    if (!own) return [{ ...shell, container: true, usage: TEXT.shellUsage(shell.name, null, subcommands.map((subcommand) => String(subcommand.name))), subcommands: subcommands }];
    const { parent: _parent, ownRun: _ownRun, ...run } = own;
    const ownUsage = typeof run.usage === 'string' ? run.usage : shell.name;
    const usage = TEXT.shellUsage(shell.name, ownUsage, subcommands.map((subcommand) => String(subcommand.name)));
    return [{ ...shell, ...run, name: shell.name, ownUsage, usage, subcommands: subcommands }];
  });
}

export const consoleFeatureOf = (id: FeatureId, parts: readonly CapabilityParts[], { commands = [], shells = [], listSections = {}, ...extra }: ConsoleFeatureExtra = {}): ConsoleFeature => {
  const tagged = parts.flatMap((part) => (part.commands ?? []).map((command) => ({ capability: part.capability, ...command })));
  return Object.freeze({
    ...extra,
    id,
    commands: [...commands, ...tagged.filter((command) => command.parent === undefined) as CommandDefinition[], ...assemble(shells, tagged)],
    overrides: parts.flatMap((part) => (part.overrides ?? []).map((override) => ({ capability: part.capability, ...override }))),
    settings: Object.fromEntries(parts.flatMap((part) => Object.entries(part.settings ?? {}).map(([key, spec]) => [key, { capability: part.capability, ...spec }]))),
    listSections: { ...listSections, ...Object.assign({}, ...parts.filter((part) => isCapabilityOn(part.capability)).map((part) => part.listSections ?? {})) as Record<string, ListSection> },
    start: () => {
      extra.start?.();
      for (const part of parts) if (isCapabilityOn(part.capability)) part.start?.();
    },
  });
};
