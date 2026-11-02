import type { FeatureId } from '#shared/features/keys.ts';
import type { Logger } from '#kernel/log/logger.ts';

export type RequestContext = Readonly<{ remote?: boolean; server?: boolean; [field: string]: unknown }>;

export type DevRoute = Readonly<{
  name: string;
  handle(request: Request, url: URL, context: RequestContext): Promise<Response>;
}>;

export type Interceptor = (request: Request, url: URL, context: RequestContext) => Promise<Response | null>;

export type WrapperFeature = Readonly<{
  id: FeatureId;
  routes?: readonly DevRoute[];
  interceptors?: readonly Interceptor[];
}>;

export type WrapperDeps = Readonly<{
  log: Logger;
  isCapabilityOn(id: string): boolean;
  gameVersion: string;
  isSadburst: boolean;
  repoRoot: string;
  gameDir: string;
  devKvFile: string;
  host: string;
}>;
