import { isFeatureOn } from '#console/flags.ts';
import { lobbyTaskGuardPage } from '#features/lobby_task_guard/page.ts';
import { serverListPage } from '#features/server_list/page.ts';
import { diagnosticsPage } from '#features/diagnostics/page.ts';
import type { PageFeature } from './feature-types.ts';

export const PAGE_FEATURES: readonly PageFeature[] = Object.freeze([
  lobbyTaskGuardPage,
  serverListPage,
  diagnosticsPage,
]);

export const enabledPageFeatures = (features: readonly PageFeature[] = PAGE_FEATURES): PageFeature[] => features.filter((feature) => isFeatureOn(feature.id));
