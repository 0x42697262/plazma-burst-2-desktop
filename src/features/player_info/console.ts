import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { PLAYER_INFO_PARTS } from './capabilities.ts';

export const playerInfoConsole = consoleFeatureOf(FEATURE.playerInfo, PLAYER_INFO_PARTS);
