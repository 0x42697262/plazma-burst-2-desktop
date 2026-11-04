import { IN_OVERLAY } from '#console/kernel/ui/theme.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import {
  FONT_SIZE, ICON, LAYERS_BUTTON_WIDTH, LEFT_W, OBJECTS_H, PANEL_AREA, PICTURE, PICTURE_HEAD_SIZE, RIGHT_W, SCROLLBAR, TOOL_SIZE,
} from './constants.ts';

type Style = Readonly<Record<string, string>>;

const px = (value: number): string => `${value}px`;

export const PALETTE = Object.freeze({
  panel: '#000000d9',
  panelEdge: '#101010',
  box: '#141414',
  button: '#141414',
  buttonText: '#8b8b8b',
  buttonHover: '#0f0f0f',
  active: '#2d2d2d',
  activeEdge: '#515151',
  rowSelected: '#252525',
  label: '#626262',
  labelBack: '#252525',
  value: '#8b8b8b',
  valueBack: '#333333',
  valueEdge: '#2a2a2a',
  title: '#c8c8c8',
  muted: '#595959',
  scrollThumb: '#515151',
  scrollTrack: 'rgba(0,0,0,0.2)',
});

export const FONT = 'Tahoma, Verdana, sans-serif';
export const SCROLLS = 'pb2dev-editor-scroll';
export const STYLESHEET_ID = 'pb2dev-editor-style';
export const STYLESHEET = `
.${SCROLLS}::-webkit-scrollbar { width: ${SCROLLBAR}px; height: ${SCROLLBAR}px; }
.${SCROLLS}::-webkit-scrollbar-track { border-radius: ${SCROLLBAR}px; background-color: ${PALETTE.scrollTrack}; }
.${SCROLLS}::-webkit-scrollbar-thumb { border-radius: ${SCROLLBAR}px; background-color: ${PALETTE.scrollThumb}; }
.${SCROLLS}::-webkit-scrollbar-corner { background: transparent; }
`;
export const iconUrl = (kind: string): string => `/level_editor/icons16/${kind}.gif`;
export const TRANSPARENT = 'transparent';
export const WHITE = '#ffffff';
const thinBorder = (color: string): string => `0.5px solid ${color}`;

export const CLICK_EVENT = 'click';
export const KEY_DOWN_EVENT = 'keydown';
export const KEY_UP_EVENT = 'keyup';
export const BLUR_EVENT = 'blur';
export const INPUT_EVENT = 'input';
export const MOUSE_DOWN_EVENT = 'mousedown';
export const POINTER_DOWN_EVENT = 'pointerdown';
export const HOVER_EVENTS = Object.freeze({ enter: 'mouseenter', leave: 'mouseleave' } as const);
export const POINTER_EVENT = Object.freeze({ down: 'pointerdown', move: 'pointermove', up: 'pointerup' } as const);
export const BLOCKED_DURING_PRESS: readonly string[] = Object.freeze(['mousedown', 'mouseup', 'click']);
export const KEY_NAME = Object.freeze({ enter: 'Enter', escape: 'Escape' });

export const PANEL_STYLE = (place: Style): Style => ({
  ...IN_OVERLAY, position: 'absolute', ...place, boxSizing: 'border-box', zIndex: '45',
  background: PALETTE.panel, fontFamily: FONT, fontSize: px(FONT_SIZE), color: PALETTE.value,
  overflowX: 'hidden', overflowY: 'auto', pointerEvents: 'auto', cursor: 'default', userSelect: 'none',
});
export const CAPTION_STYLE: Style = Object.freeze({ color: PALETTE.title, margin: '2px 2px 1px', whiteSpace: 'nowrap' });
export const ICON_STYLE: Style = Object.freeze({ width: px(ICON), height: px(ICON), verticalAlign: 'middle', imageRendering: 'pixelated', flex: 'none' });
export const BUTTON_STYLE = (active: boolean, enabled: boolean, style: Style): Style => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '1px', boxSizing: 'border-box',
  margin: '1px', padding: '0 1px', borderRadius: '1.5px', whiteSpace: 'nowrap', overflow: 'hidden',
  border: thinBorder(active ? PALETTE.activeEdge : PALETTE.button), background: active ? PALETTE.active : PALETTE.button,
  color: PALETTE.buttonText, opacity: enabled ? '1' : '0.4', cursor: enabled ? 'pointer' : 'default', ...style,
});
export const LIST_ROW_STYLE = (isSelected: boolean): Style => ({
  display: 'flex', alignItems: 'center', gap: '2px', height: px(ICON + 1), padding: '0 1px', whiteSpace: 'nowrap',
  overflow: 'hidden', background: isSelected ? PALETTE.rowSelected : TRANSPARENT, cursor: 'pointer',
});
export const LIST_ROW_TEXT_STYLE: Style = Object.freeze({ overflow: 'hidden', textOverflow: 'ellipsis' });
export const PARAM_ROW_STYLE: Style = Object.freeze({ display: 'flex', height: '9px', lineHeight: '9px', marginBottom: '0.5px' });
export const PARAM_LABEL_STYLE: Style = Object.freeze({
  width: '46px', flex: 'none', textAlign: 'right', paddingRight: '2px', boxSizing: 'border-box', overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: PALETTE.label, background: PALETTE.labelBack,
  borderBottom: thinBorder(PALETTE.labelBack),
});
export const PARAM_VALUE_STYLE: Style = Object.freeze({
  flex: '1', minWidth: '0', paddingLeft: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  color: PALETTE.value, background: PALETTE.valueBack, borderBottom: thinBorder(PALETTE.valueEdge), cursor: 'text',
});

export const CHOICE_LIST_ATTRIBUTE = 'list';
export const choicesId = (count: number): string => `pb2dev-choices-${count}`;
export const EDIT_FIELD_STYLE: Style = Object.freeze({
  width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: px(FONT_SIZE), color: PALETTE.title,
  background: PALETTE.box, border: thinBorder(PALETTE.activeEdge), padding: '0 1px', height: '9px',
});

const DROPDOWN_BOX = Object.freeze({ background: 'rgba(0,0,0,0.8)', border: '0.5px solid #000', padding: '1.3px' });
export const ROW_COLOR = Object.freeze({ hover: 'rgba(144,255,0,0.4)', current: 'rgba(100,150,255,0.4)', pressed: 'rgba(144,255,0,0.7)' });
export const DO_NOTHING = '-1';
export const LEADING_MINUS = /^-/;
export const NEGATIVE_PREFIX = '-';
export const DROPDOWN_TEXT = Object.freeze({
  separator: '›',
  searched: (label: string | undefined, value: string | undefined) => `${label} ${value ?? ''}`,
  everything: 'Everything',
  doNothing: 'Do Nothing',
});
export const DROPDOWN_FIELD_STYLE: Style = Object.freeze({
  width: '100%', boxSizing: 'border-box', height: '9px', padding: '0 1px', fontFamily: FONT, fontSize: px(FONT_SIZE),
  color: WHITE, background: '#000', border: thinBorder(PALETTE.activeEdge),
});
export const pictureStyle = (src: string, head: boolean): Style => ({
  width: px(PICTURE), height: px(PICTURE), flex: 'none', display: 'inline-block',
  backgroundImage: `url("${src}")`, backgroundRepeat: 'no-repeat',
  ...(head ? { backgroundSize: px(PICTURE_HEAD_SIZE), backgroundPosition: '30% 26%' } : { backgroundSize: 'contain', backgroundPosition: 'center' }),
});
export const ROW_STYLE = (isCurrent: boolean): Style => ({
  display: 'flex', alignItems: 'center', gap: '2px', padding: '1.3px', whiteSpace: 'nowrap', overflow: 'hidden',
  textOverflow: 'ellipsis', color: WHITE, cursor: 'pointer', background: isCurrent ? ROW_COLOR.current : TRANSPARENT,
});
export const ROW_SEPARATOR_STYLE: Style = Object.freeze({ color: 'rgba(255,255,255,0.4)' });
export const ROW_LABEL_STYLE: Style = Object.freeze({ overflow: 'hidden', textOverflow: 'ellipsis' });
export const actionsBoxPlace = (left: number, width: number, height: number): Style => ({ left: px(left), top: '0', width: px(width), height: px(height) });
export const dropdownPlace = (left: number, top: number, width: number, maxHeight: number): Style => ({
  left: px(left), top: px(top), width: px(width), maxHeight: px(maxHeight),
});
export const DROPDOWN_BOX_STYLE = (place: Style): Style => ({
  ...IN_OVERLAY, position: 'absolute', ...place, zIndex: '48', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
  background: DROPDOWN_BOX.background, border: DROPDOWN_BOX.border, padding: DROPDOWN_BOX.padding, fontFamily: FONT, fontSize: px(FONT_SIZE),
  pointerEvents: 'auto', userSelect: 'none',
});
export const DROPDOWN_LIST_STYLE: Style = Object.freeze({ overflowY: 'auto', flex: '1', minHeight: '0' });
export const CATEGORY_BAR_STYLE: Style = Object.freeze({ display: 'flex', flexWrap: 'wrap', background: '#000', marginBottom: '1px' });
export const CATEGORY_TAG_STYLE = (color: string): Style => ({ padding: '1.3px 3px', color, cursor: 'pointer' });

export const ICON_NAME = Object.freeze({ select: 'edit' });
export const PANEL_PLACE = Object.freeze({
  left: { left: '0', top: '0', width: px(LEFT_W), height: px(PANEL_AREA.height), borderRight: thinBorder(PALETTE.panelEdge) },
  right: { left: px(PANEL_AREA.width - RIGHT_W), top: '0', width: px(RIGHT_W), height: px(PANEL_AREA.height), borderLeft: thinBorder(PALETTE.panelEdge) },
  status: { left: px(LEFT_W), top: '2px', width: px(PANEL_AREA.width - LEFT_W - RIGHT_W) },
});
export const TOOL_GRID_STYLE: Style = Object.freeze({ display: 'grid', gridTemplateColumns: `repeat(2, ${TOOL_SIZE}px)`, justifyContent: 'center' });
export const TOOL_SQUARE: Style = Object.freeze({ width: px(TOOL_SIZE), height: px(TOOL_SIZE) });
export const SMALL_TOOL: Style = Object.freeze({ width: px(TOOL_SIZE), height: '8px' });
export const ACTIONS_STYLE: Style = Object.freeze({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2px' });
export const LAYERS_BUTTON: Style = Object.freeze({ width: px(LAYERS_BUTTON_WIDTH), height: '9px' });
export const LAYER_LIST_BUTTON: Style = Object.freeze({ ...LAYERS_BUTTON, justifyContent: 'flex-start' });
export const MUTED_STYLE: Style = Object.freeze({ color: PALETTE.muted });
export const NOTICE_STYLE: Style = Object.freeze({ color: COLOR.notice });
export const PARAMS_HEAD_STYLE: Style = Object.freeze({ display: 'flex', alignItems: 'center', gap: '2px', margin: '2px 2px 3px', color: PALETTE.title });
export const DIMMED_OPACITY = '0.55';
export const OBJECTS_BOX_STYLE: Style = Object.freeze({
  height: px(OBJECTS_H), overflowY: 'auto', margin: '0 2px', padding: '1px', background: PALETTE.box, borderRadius: '2.5px',
});
export const OBJECT_SEARCH_ROW_STYLE: Style = Object.freeze({ display: 'flex', alignItems: 'center', gap: '2px', margin: '0 2px 2px' });
export const OBJECT_SEARCH_STYLE: Style = Object.freeze({ ...EDIT_FIELD_STYLE, flex: '1', width: 'auto', minWidth: '0' });
export const SORT_BUTTON: Style = Object.freeze({ width: 'auto', height: '9px', padding: '0 2px', flex: 'none' });
export const SECTION_GAP_STYLE: Style = Object.freeze({ height: '4px' });
export const STATUS_STYLE: Style = Object.freeze({
  ...IN_OVERLAY, position: 'absolute', ...PANEL_PLACE.status, zIndex: '45', textAlign: 'center', pointerEvents: 'none',
  fontFamily: FONT, fontSize: px(FONT_SIZE), color: PALETTE.title, textShadow: '0 0 1px #000',
});
export const PANEL_STATE = Object.freeze({ none: 'none', detached: 'made, but not on the page', onPage: 'on the page' });

export const ACTION_SIDES = Object.freeze(['A', 'B'] as const);
export const INTEGER_TEXT = /^-?\d+$/;
export const NOCHANGE_OPACITY = '0.5';
export const REMOVE_BUTTON_STYLE: Style = Object.freeze({ width: '8px', height: '8px', flex: 'none' });
export const TRIGGER_ACTS_STYLE: Style = Object.freeze({ display: 'flex', flexWrap: 'wrap', margin: '2px' });
export const ERROR_LINE_STYLE: Style = Object.freeze({ color: COLOR.error, fontFamily: FONT });
export const TRIGGER_TEXT_STYLE: Style = Object.freeze({
  width: 'calc(100% - 4px)', height: '160px', margin: '0 2px', boxSizing: 'border-box', resize: 'vertical',
  fontFamily: 'monospace', fontSize: px(FONT_SIZE), color: PALETTE.title, background: PALETTE.box,
  border: thinBorder(PALETTE.activeEdge), whiteSpace: 'pre', overflow: 'auto',
});

export const LAYER_NAME = 'editor';
export const OUTLINE_ALPHA = '99';
export const INACTIVE_ALPHA = '2e';
export const SELECTED_FILL = '22';
export const SELECTED_FALLBACK_COLOR = '#ffffff';
export const PICK_FALLBACK_COLOR = '#ffffff';
export const LINK_COLOR = Object.freeze({ out: '#66ff66', in: '#ffffff' });
export const PICK_IMAGES = Object.freeze({ idle: '/level_editor/quickpick.png', over: '/level_editor/quickpick2.png' });
export const PICK_IMAGE_STATE = Object.freeze({ idle: 'idle', over: 'over' } as const);
export type PickImageState = typeof PICK_IMAGE_STATE[keyof typeof PICK_IMAGE_STATE];

export const AUTO = 'auto';
export const CLASS_SEPARATOR = '.';
export const WHITESPACE = /\s+/;
export const EDGE_MARK = Object.freeze({ left: 'l', right: 'r', top: 't', bottom: 'b' });
export const GRAB_MOVE = 'move';

export const EDITOR_KEYS = Object.freeze({
  escape: 'escape', delete: 'delete', duplicate: 'ctrl+d', undo: 'ctrl+z', redo: 'ctrl+y', redoShift: 'ctrl+shift+z',
});
