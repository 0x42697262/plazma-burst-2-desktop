import type { ConsoleFeature, CommandDefinition, ConsoleTick, FrameHook } from './feature-types.ts';
import { isFeatureOn } from './flags.ts';

export const CONSOLE_FEATURES: readonly ConsoleFeature[] = Object.freeze([]);

export const enabledConsoleFeatures = (features: readonly ConsoleFeature[] = CONSOLE_FEATURES): ConsoleFeature[] => features.filter((feature) => isFeatureOn(feature.id));

export const featureCommands = (features: readonly ConsoleFeature[]): CommandDefinition[] => features.flatMap((feature) => feature.commands ?? []);
export const featureFrameHooks = (features: readonly ConsoleFeature[]): FrameHook[] => features.flatMap((feature) => feature.frame ?? []);
export const featureTicks = (features: readonly ConsoleFeature[]): ConsoleTick[] => features.flatMap((feature) => feature.ticks ?? []);
