import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { GAME_CHAT_PARTS } from './capabilities.ts';

export const gameChatConsole = consoleFeatureOf(FEATURE.gameChat, GAME_CHAT_PARTS);
