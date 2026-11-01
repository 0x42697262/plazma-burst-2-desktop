import type { FeatureId } from '#shared/features/keys.ts';

export type RequestContext = Readonly<{ remote?: boolean; server?: boolean; [field: string]: unknown }>;

export type DevRoute = Readonly<{
  name: string;
  handle(request: Request, url: URL, context: RequestContext): Promise<Response>;
}>;

export type WrapperFeature = Readonly<{
  id: FeatureId;
  routes?: readonly DevRoute[];
}>;
