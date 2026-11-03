export const FRAME_HOOK_NAME = 'Editor';
export const LIST_SECTION = 'editor';
export const EDIT_KINDS = Object.freeze(['changed', 'added', 'deleted'] as const);

export const COMMAND = Object.freeze({ name: 'editor', aliases: Object.freeze(['edit', 'mapedit']) });
export const ON_WORDS: readonly string[] = Object.freeze(['on', '1', 'true', 'yes']);
export const OFF_WORDS: readonly string[] = Object.freeze(['off', '0', 'false', 'no']);
export const FIRST_TWO_WORDS = /^\S+\s+\S+\s*/;
export const QUOTED_VALUE = /^"(.*)"$/;
export const UNQUOTE = '$1';
export const FORCE_OPTION = 'force';
export const LOAD_OPTION = Object.freeze({
  add: 'add', sync: 'sync', dry: 'dry', reset: 'reset', mapNumbers: 'map-numbers', here: 'here', only: 'only', at: 'at', offset: 'offset', watch: 'watch',
});
export const LOAD_FLAGS: readonly string[] = Object.freeze([LOAD_OPTION.add, LOAD_OPTION.sync, LOAD_OPTION.dry, LOAD_OPTION.reset, LOAD_OPTION.mapNumbers, LOAD_OPTION.here, LOAD_OPTION.watch]);
export const LOAD_VALUED: Readonly<Record<string, number>> = Object.freeze({ [LOAD_OPTION.only]: 1, [LOAD_OPTION.at]: 2, [LOAD_OPTION.offset]: 2 });
export const PLACEMENT_OPTIONS: readonly string[] = Object.freeze([LOAD_OPTION.at, LOAD_OPTION.offset, LOAD_OPTION.here]);
export const EXPORT_OPTION = Object.freeze({ to: 'to', force: 'force' });
export const EXPORT_VALUED: Readonly<Record<string, number>> = Object.freeze({ [EXPORT_OPTION.to]: 1 });
export const EXISTS_PATTERN = /exists/;
export const LAYER_ALL = 'all';
export const LAYER_NONE_WORDS: readonly string[] = Object.freeze(['nothing', 'none']);
export const SIGNED_LAYER = /^[+-]/;
export const LAYER_SIGN = Object.freeze({ add: '+' });
export const LAYER_WORD_SEPARATOR = ',';
export const SELECT_WORD = 'select';
export const PLACE_WORD = 'place';
export const NAME_JOIN = ' ';
export const SETTING = Object.freeze({ editorKey: 'editor_key' });
