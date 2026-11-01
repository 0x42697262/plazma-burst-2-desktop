import type { ConsoleFeature, CommandDefinition, ConsoleTick, FrameHook } from './feature-types.ts';
import { isFeatureOn } from './flags.ts';
import { netlogConsole } from '#features/netlog/console.ts';
import { serverListConsole } from '#features/server_list/console.ts';
import { lobbyTaskGuardConsole } from '#features/lobby_task_guard/console.ts';
import { fingerprintConsole } from '#features/fingerprint/console.ts';
import { screenshotConsole } from '#features/screenshot/console.ts';

export const CONSOLE_FEATURES: readonly ConsoleFeature[] = Object.freeze([
  lobbyTaskGuardConsole,
  netlogConsole,
  fingerprintConsole,
  serverListConsole,
  screenshotConsole,
]);

export const enabledConsoleFeatures = (features: readonly ConsoleFeature[] = CONSOLE_FEATURES): ConsoleFeature[] => features.filter((feature) => isFeatureOn(feature.id));

export const featureCommands = (features: readonly ConsoleFeature[]): CommandDefinition[] => features.flatMap((feature) => feature.commands ?? []);
export const featureFrameHooks = (features: readonly ConsoleFeature[]): FrameHook[] => features.flatMap((feature) => feature.frame ?? []);
export const featureTicks = (features: readonly ConsoleFeature[]): ConsoleTick[] => features.flatMap((feature) => feature.ticks ?? []);
