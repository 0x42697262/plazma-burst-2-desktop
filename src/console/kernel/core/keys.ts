export const COLOR = Object.freeze({
  title: '#89D0FF',
  ok: '#66ff88',
  error: '#ff6666',
  notice: '#ffff88',
  warn: '#ffd84d',
  hint: '#ffffff99',
  muted: '#ffffff77',
  bright: '#EEF9FF',
  plain: '#ffffff',
});

export const OPTION_PREFIX = '--';
export const END_OF_OPTIONS = '--';
export const HELP_WORDS: readonly string[] = Object.freeze(['help', '--help', '-h']);
export const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;
export const INDEX_TEXT = /^#?\d+$/;
export const INDEX_MARK = '#';
export const PATTERN_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
export const ESCAPED_MATCH = '\\$&';
export const HTML_TAG = /<[^>]*>/g;
export const HTML_ENTITY = Object.freeze({ lessThan: /&lt;/g, greaterThan: /&gt;/g, ampersand: /&amp;/g });
export const HTML_CHARACTER = Object.freeze({ lessThan: '<', greaterThan: '>', ampersand: '&' });
export const PLURAL_SUFFIX = 's';
export const ELLIPSIS = '...';
