import type { FeatureId } from '#shared/features/keys.ts';

export type CommandDefinition = Readonly<{ name: string; [field: string]: unknown }>;
export type FrameHook = Readonly<{ name: string; run(): void }>;
export type ConsoleTick = Readonly<{ name: string; everyMs: number; errorsShown: number; run(): void }>;

export type ConsoleFeature = Readonly<{
  id: FeatureId;
  commands?: readonly CommandDefinition[];
  frame?: readonly FrameHook[];
  ticks?: readonly ConsoleTick[];
  start?(): void;
}>;
