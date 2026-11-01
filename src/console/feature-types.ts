import type { MovingCharacter } from './kernel/game/types.ts';
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
  ticks?: readonly ConsoleTick[];
  listSections?: Readonly<Record<string, ListSection>>;
  start?(): void;
}>;

export type CapabilityParts = Readonly<{ capability: string; commands?: readonly CommandDefinition[]; overrides?: readonly FrameOverride[] }>;

export const consoleFeatureOf = (id: FeatureId, parts: readonly CapabilityParts[], extra: Omit<ConsoleFeature, 'id' | 'commands' | 'overrides'> = {}): ConsoleFeature => Object.freeze({
  id,
  commands: parts.flatMap((part) => (part.commands ?? []).map((command) => ({ capability: part.capability, ...command }))),
  overrides: parts.flatMap((part) => (part.overrides ?? []).map((override) => ({ capability: part.capability, ...override }))),
  ...extra,
});
