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
