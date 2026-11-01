import type { FeatureId } from '#shared/features/keys.ts';
import type { Logger } from '#kernel/log/logger.ts';

export type RequestContext = Readonly<{ remote?: boolean; server?: boolean; [field: string]: unknown }>;

export type DevRoute = Readonly<{
  name: string;
  handle(request: Request, url: URL, context: RequestContext): Promise<Response>;
}>;

export type WrapperFeature = Readonly<{
  id: FeatureId;
  routes?: readonly DevRoute[];
}>;

export type WrapperDeps = Readonly<{
  log: Logger;
  gameVersion: string;
  isSadburst: boolean;
  repoRoot: string;
}>;
