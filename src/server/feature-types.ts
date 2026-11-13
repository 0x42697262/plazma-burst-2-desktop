import type http from 'node:http';
import type { FeatureId } from '#shared/features/keys.ts';
import type { Logger } from '#kernel/log/logger.ts';
import type { MapSourceSetting, ServerConfig } from './config.ts';
import type { MapSource } from './maps.ts';

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

export type ServerFeature = Readonly<{
  id: FeatureId;
  mapSources?: (context: ServerFeatureContext) => Readonly<Record<string, MapSourceMaker>>;
  http?: (context: ServerFeatureContext) => HttpHandler;
}>;
