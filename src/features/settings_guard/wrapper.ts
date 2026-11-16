import { FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { askInDialog } from './adapters/dialog.ts';
import { settingsGuardInterceptor } from './entry/interceptor.ts';

export const settingsGuardWrapper = (deps: WrapperDeps): WrapperFeature => Object.freeze({
  id: FEATURE.settingsGuard,
  interceptors: [settingsGuardInterceptor({ confirm: askInDialog, log: (message) => deps.log.warn(message) })],
});
