import type { WrapperDeps, WrapperFeature } from './feature-types.ts';
import { netlogWrapper } from '#features/netlog/wrapper.ts';

export const wrapperFeatures = (deps: WrapperDeps): WrapperFeature[] => [
  netlogWrapper(deps),
];
