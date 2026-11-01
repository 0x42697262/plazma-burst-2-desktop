import { ESCAPE_WIDTH, HEX_RADIX } from '../constants.ts';
import { EDITED_NAME, ESCAPE_PAD, ESCAPE_PREFIX, HIDDEN_PREFIX, LOCAL_MAP_PREFIX, SAVED_EXTENSION, UNSAFE_ID_CHARACTER } from '../keys.ts';

export const mapFileName = (id: string): string => id.replace(UNSAFE_ID_CHARACTER, (character) => ESCAPE_PREFIX + character.charCodeAt(0).toString(HEX_RADIX).padStart(ESCAPE_WIDTH, ESCAPE_PAD)) + SAVED_EXTENSION;
export const isLocalMapId = (id: string): boolean => id.toLowerCase().startsWith(LOCAL_MAP_PREFIX);
export const localNameOf = (id: string): string => id.slice(LOCAL_MAP_PREFIX.length);
export const localMapId = (name: string): string => LOCAL_MAP_PREFIX + name;
export const isEditedName = (name: string | null | undefined): name is string => EDITED_NAME.test(name ?? '') && !(name ?? '').startsWith(HIDDEN_PREFIX);
