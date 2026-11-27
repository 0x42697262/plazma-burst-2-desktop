import type http from 'node:http';
import type { FeatureId } from '#shared/features/keys.ts';
import type { Logger } from '#kernel/log/logger.ts';
import type { MapSourceSetting, ServerConfig } from './config.ts';
import type { MapSource, Maps } from './maps.ts';
import type { ChatListener, GameServer } from './game.ts';

export type ServerFeatureContext = Readonly<{
  config: ServerConfig;
  gameDir: string;
  dataDir: string;
  names: Readonly<Record<string, string>>;
  namesScript: string;
  log: Logger;
}>;

export type MapSourceMaker = (setting: MapSourceSetting) => MapSource;
export type HttpHandler = (request: http.IncomingMessage, response: http.ServerResponse) => boolean;
export type ServerRuntime = Readonly<{ game: GameServer; maps: Maps }>;
export type TerminalCommand = Readonly<{ help: readonly string[]; run(rest: string): void }>;

export type ServerFeature = Readonly<{
  id: FeatureId;
  mapSources?: (context: ServerFeatureContext) => Readonly<Record<string, MapSourceMaker>>;
  http?: (context: ServerFeatureContext) => HttpHandler;
  commands?: (context: ServerFeatureContext, runtime: ServerRuntime) => Readonly<Record<string, TerminalCommand>>;
  chat?: (context: ServerFeatureContext, runtime: ServerRuntime) => ChatListener;
}>;
