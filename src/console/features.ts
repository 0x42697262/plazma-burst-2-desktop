import type { ConsoleFeature, CommandDefinition, ConsoleTick, FrameHook } from './feature-types.ts';
import type { ListSection } from './kernel/list-sections.ts';
import { isFeatureOn } from './flags.ts';
import { netlogConsole } from '#features/netlog/console.ts';
import { serverListConsole } from '#features/server_list/console.ts';
import { fingerprintConsole } from '#features/fingerprint/console.ts';
import { screenshotConsole } from '#features/screenshot/console.ts';
import { jsEvalConsole } from '#features/js_eval/console.ts';
import { zoomConsole } from '#features/zoom/console.ts';
import { gameChatConsole } from '#features/game_chat/console.ts';
import { traceConsole } from '#features/trace/console.ts';
import { profilesConsole } from '#features/profiles/console.ts';
import { bindsConsole } from '#features/binds/console.ts';
import { gunsConsole } from '#features/guns/console.ts';
import { playerConsole } from '#features/player/console.ts';
import { scanBypassConsole } from '#features/scan_bypass/console.ts';
import { mapCacheConsole } from '#features/map_cache/console.ts';
import { hooksConsole } from '#features/hooks/console.ts';
import { triggersConsole } from '#features/triggers/console.ts';
import { mapEditorConsole } from '#features/map_editor/console.ts';
import { p2pHostConsole } from '#features/p2p_host/console.ts';

export const CONSOLE_FEATURES: readonly ConsoleFeature[] = Object.freeze([
  netlogConsole,
  fingerprintConsole,
  serverListConsole,
  screenshotConsole,
  jsEvalConsole,
  zoomConsole,
  gameChatConsole,
  traceConsole,
  profilesConsole,
  bindsConsole,
  gunsConsole,
  playerConsole,
  scanBypassConsole,
  mapCacheConsole,
  hooksConsole,
  triggersConsole,
  mapEditorConsole,
  p2pHostConsole,
]);

export const enabledConsoleFeatures = (features: readonly ConsoleFeature[] = CONSOLE_FEATURES): ConsoleFeature[] => features.filter((feature) => isFeatureOn(feature.id));

export const featureCommands = (features: readonly ConsoleFeature[]): CommandDefinition[] => features.flatMap((feature) => feature.commands ?? []);
export const featureFrameHooks = (features: readonly ConsoleFeature[]): FrameHook[] => features.flatMap((feature) => feature.frame ?? []);
export const featureTicks = (features: readonly ConsoleFeature[]): ConsoleTick[] => features.flatMap((feature) => feature.ticks ?? []);

export const featureListSections = (features: readonly ConsoleFeature[]): [string, ListSection][] => features.flatMap((feature) => Object.entries(feature.listSections ?? {}));
