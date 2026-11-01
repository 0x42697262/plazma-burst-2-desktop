import type { FeatureId } from '#shared/features/keys.ts';
import type { DevRoute, Interceptor, RequestContext, WrapperFeature } from '../feature-types.ts';
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

export function createInterceptor(features: readonly WrapperFeature[], isOn: (id: FeatureId) => boolean): Interceptor {
  const interceptors = features.filter((feature) => isOn(feature.id)).flatMap((feature) => feature.interceptors ?? []);
  return async (request, url, context) => {
    for (const interceptor of interceptors) {
      const response = await interceptor(request, url, context);
      if (response) return response;
    }
    return null;
  };
}
