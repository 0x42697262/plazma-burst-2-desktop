import type { FeatureId } from '#shared/features/keys.ts';
import type { DevRoute, RequestContext, WrapperFeature } from '../feature-types.ts';
import { TEXT } from './text.ts';

export type DevRouter = (name: string, request: Request, url: URL, context: RequestContext) => Promise<Response | null>;

export function createDevRouter(features: readonly WrapperFeature[], isOn: (id: FeatureId) => boolean): DevRouter {
  const routes = new Map<string, DevRoute>();
  for (const feature of features.filter((candidate) => isOn(candidate.id))) {
    for (const route of feature.routes ?? []) {
      if (routes.has(route.name)) throw new Error(TEXT.duplicateRoute(route.name));
      routes.set(route.name, route);
    }
  }
  return async (name, request, url, context) => {
    const route = routes.get(name);
    return route ? route.handle(request, url, context) : null;
  };
}
