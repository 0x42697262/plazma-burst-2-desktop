export const THEME = Object.freeze({
  background: '#0E2236e5',
  scrollThumb: '#3C9DFF',
  scrollTrack: '#01010119',
  inputBackground: '#00000066',
  inputBorder: '1px solid rgba(60,157,255,0.3)',
  font: 'DejaVuSansMono',
  titleFont: 'EuropeExt',
});

export const IN_OVERLAY = Object.freeze({ visibility: 'visible' });

export const SWALLOWED_EVENTS: readonly string[] = Object.freeze(['keydown', 'keypress', 'mousedown', 'mouseup', 'click', 'dblclick',
  'wheel', 'contextmenu', 'pointerdown', 'pointerup', 'touchstart', 'touchend']);

export const UI_MARK = 'pb2devUi';

export const LOG_TAG = '[pb2dev]';
export const LINE_ELEMENT = 'div';
export const SEGMENT_ELEMENT = 'span';
export const SMALL_TEXT_SIZE = '0.8em';

export const PAGE_WORDS: readonly string[] = Object.freeze(['page', 'pg']);
export const DIGITS_ONLY = /^\d+$/;

export const LABEL_STYLE = Object.freeze({
  color: '#ffffffdd',
  plate: '#000000aa',
  openPlate: '#0E2236ee',
  leader: '#ffffff55',
  font: (size: number) => `${size}px DejaVuSansMono`,
  baseline: 'top',
});

export const OVERLAY_ID = 'pb2dev-overlay';
export const CANVAS_ELEMENT = 'canvas';
export const CONTEXT_2D = '2d';
export const OVERLAY_STYLE = Object.freeze({ position: 'fixed', pointerEvents: 'none' });
export const DEFAULT_OVERLAY_Z_INDEX = '2';
export const PIXELS = (value: number): string => `${value}px`;

export const PANEL = Object.freeze({
  id: 'pb2dev',
  zIndex: '50',
  buttonElement: 'pb2Button',
  inputElement: 'input',
  inputClass: 'pb2Input',
  inputType: 'text',
  autocomplete: 'off',
  placeholder: 'type a command, e.g. "god on" or "help"',
  title: 'Developer console',
  shown: 'block',
  hidden: 'none',
  visible: 'visible',
  invisible: 'hidden',
  listCommand: 'list',
  helpCommand: 'help',
  hintSeparator: '  ',
  textType: 'text',
  pasteEvent: 'paste',
  keyDownEvent: 'keydown',
  clickEvent: 'click',
});
export const PANEL_KEY = Object.freeze({ enter: 'Enter', up: 'ArrowUp', down: 'ArrowDown', tab: 'Tab', escape: 'Escape' });
export const TEXT_INPUT_TAGS: readonly string[] = Object.freeze(['INPUT', 'TEXTAREA']);
export const MODIFIER_CODE = /^(shift|control|alt|meta|os)(left|right)?$/i;
export const FUNCTION_KEY = /^f\d+$/;
export const LINE_BREAK = /[\r\n]/;
export const LINE_SPLIT = /\r?\n/;
export const SPACE = ' ';
export const WORDS = /\s+/;
export const ROOT_STYLE = Object.freeze({
  position: 'absolute', left: '10px', top: '40px', width: '780px', height: '320px',
  cursor: 'default', boxSizing: 'border-box', userSelect: 'text', pointerEvents: 'auto',
});
export const TITLE_STYLE = Object.freeze({ position: 'absolute', left: '0', top: '4px', width: '100%', textAlign: 'center', fontSize: '10px' });
export const STATUS_STYLE = Object.freeze({ position: 'absolute', right: '10px', top: '6px', fontSize: '6px' });
export const LOG_STYLE = Object.freeze({
  position: 'absolute', left: '10px', top: '20px', width: '760px', height: '246px',
  overflowY: 'auto', fontSize: '7px', lineHeight: '8px', whiteSpace: 'pre-wrap',
  wordBreak: 'break-word', scrollbarWidth: 'thin',
});
export const INPUT_STYLE = Object.freeze({
  position: 'absolute', left: '10px', top: '270px', width: '760px', height: '16px', fontSize: '7px', padding: '2px 4px',
});
export const BUTTON_STYLE = Object.freeze({ position: 'absolute', top: '293px', width: '180px', height: '20px', fontSize: '9px' });
export const scrollbarColors = (thumb: string, track: string): string => `${thumb} ${track}`;
export const PROFILE_FEATURE_FLAGS = Object.freeze({ binds: 'binds' } as const);
