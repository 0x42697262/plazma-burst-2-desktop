export const COMMAND = Object.freeze({ name: 'game', helpWord: 'help' });
export const NOT_FOUND = 'command not found';
export const PANEL_FIELDS = Object.freeze(['y', 'visible', 'alpha', 'timer'] as const);
export const panelItemName = (index: number): string => `item${index}`;
export const TEXT_FIELDS = Object.freeze({ html: '_htmlText', plain: '_text' });
export const BUILTIN_COMMAND = 'builtin';
export const SETTING = Object.freeze({ builtin: 'builtin' });
