import { NOTHING_TO_LOAD } from '../keys.ts';

export const isNothingToLoad = (text: string): boolean => text === NOTHING_TO_LOAD.none || text === NOTHING_TO_LOAD.empty || text.startsWith(NOTHING_TO_LOAD.errorStart);
