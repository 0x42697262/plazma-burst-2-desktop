import type { FeatureId } from '#shared/features/keys.ts';

export type CommandDefinition = Readonly<{ name: string; [field: string]: unknown }>;
export type FrameHook = Readonly<{ name: string; run(): void }>;
export type ConsoleTick = Readonly<{ name: string; everyMs: number; errorsShown: number; run(): void }>;

import type { ListSection } from './kernel/list-sections.ts';

export type ConsoleFeature = Readonly<{
  id: FeatureId;
  commands?: readonly CommandDefinition[];
  frame?: readonly FrameHook[];
  ticks?: readonly ConsoleTick[];
  listSections?: Readonly<Record<string, ListSection>>;
  start?(): void;
}>;
