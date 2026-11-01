import { ESCAPE_WIDTH, HEX_RADIX } from './constants.ts';
import { ESCAPED_ID_CHARACTER, ESCAPE_MARK, ESCAPE_PAD, MAP_FILE_EXTENSION, MAP_FILE_SUFFIX, UNSAFE_ID_CHARACTER } from './keys.ts';

const escapeCharacter = (character: string): string => ESCAPE_MARK + character.charCodeAt(0).toString(HEX_RADIX).padStart(ESCAPE_WIDTH, ESCAPE_PAD);

export const mapFileName = (id: string): string => id.replace(UNSAFE_ID_CHARACTER, escapeCharacter) + MAP_FILE_EXTENSION;

export const mapBaseName = (id: string): string => mapFileName(id).slice(0, -MAP_FILE_EXTENSION.length);

export const mapIdOfFile = (file: string): string =>
  file.replace(MAP_FILE_SUFFIX, '').replace(ESCAPED_ID_CHARACTER, (_match, hex: string) => String.fromCharCode(parseInt(hex, HEX_RADIX)));
