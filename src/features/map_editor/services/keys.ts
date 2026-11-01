import { TAG } from '../domain/keys.ts';

export const TOOL = Object.freeze({ SELECT: 'select', PLACE: 'place' } as const);
export type Tool = typeof TOOL[keyof typeof TOOL];
export const NOTICE = Object.freeze({
  shown: 'shown', doc: 'doc', reloaded: 'reloaded', selection: 'selection', layer: 'layer', layers: 'layers', tool: 'tool', pick: 'pick',
  edit: 'edit',
} as const);
export type Notice = typeof NOTICE[keyof typeof NOTICE];

export const GAME_ID = String.raw`[$\wЀ-ӿ]+`;
export const FRAME_URL = 'scripts/frame2.js';
export const FETCH_CACHE: RequestCache = 'force-cache';
const SOURCE_PREFIX = 'pb2dev-loader';
export const BRANCH_PATTERN = /if\(\s*((?:a==[^|&)]+)(?:\|\|a==[^|&)]+)*)\s*\)\s*\{/g;
export const COUNTER_PATTERN = /(\$[^\s;=[\]().,+\-*/!&|<>?:{}"'`]+)\+\+;/g;
export const SCRATCH: readonly string[] = Object.freeze(['a', 'b', 'mc', 'i', 'i2', 'n']);
export const SCRATCH_GLOBAL = Object.freeze({ tag: 'a', attrs: 'b' });
export const WATCHDOG_PATTERN = /let ([$\wЀ-ӿ]+)=\(\)=>\s*\{\s*let t=Date\.now\(\);/;
export const CHAR = Object.freeze({
  backslash: '\\', backtick: '`', dollar: '$', open: '{', close: '}', doubleQuote: '"', singleQuote: '\'', slash: '/', star: '*',
  newline: '\n', commentEnd: '*/', parenOpen: '(', parenClose: ')',
});
export const QUOTED_TAG = /^(["']).*\1$/;
export const BRANCH_TAG_SEPARATOR = '||';
export const BRANCH_TAG_PREFIX = /^a==/;
export const LOOP_HEADER = '.children())';
export const BOX_TAG = TAG.box;
export const BRANCH_PASS = Object.freeze({ first: 'first', second: 'second' } as const);
export type BranchPass = typeof BRANCH_PASS[keyof typeof BRANCH_PASS];
export const ATTRIBUTE_MARK = '#';
export const branchRunName = (pass: string, tag: string): string => `${pass}-${tag}`;
export const watchdogBlock = (name: string, code: string): string => `{const ${name}=()=>{};\n${code}\n}`;
export const runnableCode = (body: string, name: string): string => `${body}\n//# sourceURL=${SOURCE_PREFIX}-${name}.js`;
export const STRING_TABLE_NAME = new RegExp(String.raw`(^|[^.\w$Ѐ-ӿ])(\$[\wЀ-ӿ]+)`, 'g');
export const loopHeaderPattern = (): RegExp => new RegExp(String.raw`for\((?:var |let )?(${GAME_ID})=0;\1<[^;]+;\1\+\+\)\s*`, 'g');
export const IF_OPEN = 'if(';
export const NOT_SPACE = /\S/;
export const keptName = (position: number): string => `pb2devKept${position}`;
export const saveKept = (holder: string, name: string): string => `const ${holder}=typeof ${name}==='undefined'?undefined:${name};`;
export const setKept = (name: string, json: string): string => `${name}=${json};`;
export const restoreKept = (name: string, holder: string): string => `${name}=${holder};`;
export const tryFinally = (head: string, code: string, tail: string): string => `{${head}try${code}finally{${tail}}}`;

export const START_ATTR = Object.freeze({ x: 'x', y: 'y', tarx: 'tarx', tary: 'tary', enabled: 'enabled' });
export const MISSING_FIELD = '?';
export const copyPattern = (attr: string): RegExp => new RegExp(String.raw`mc\.(${GAME_ID})=mc\["${attr}"\]=parseFloat\(b\["#${attr}"\]\)`);
export const enabledCopyPattern = (field: string): RegExp => new RegExp(String.raw`\.(${GAME_ID})=${GAME_ID}\[${GAME_ID}\]\.${field};`);

export const ATTACHMENTS_GLOBAL = 'attachments';
export const CODE_NAME = Object.freeze({ doors: 'doors', textureFollows: 'textureFollows', waters: 'waters' });
export const GAME_TEXT = Object.freeze({
  edgeHolder: 'new veh_hh',
  attachParent: 'attachments[i].parent=',
  newTexture: 'new texture_front0',
  callOpen: '(',
  lightGradient: 'createRadialGradientAndBeginFill(',
  newFlare: 'new lens_flare',
  drawWithQuality: 'drawWithQuality(',
});
export const waterShowText = (waters: string): string => `graphics_3d_front.addChildAt(${waters}[i],0)`;
export const doorIndexPattern = (doors: string): RegExp => new RegExp(`${doors}\\[i\\]`);
export const textureTiePattern = (follows: string): RegExp => new RegExp(
  String.raw`function ${follows}\(clip,(${GAME_ID})\)\s*\{\s*${GAME_ID}=(${GAME_ID})\.length;\s*\2\[${GAME_ID}\]=clip;\s*(${GAME_ID})\[${GAME_ID}\]=\1;`,
);
export const doorEdgeFieldPattern = (): RegExp => new RegExp(String.raw`mc\.(${GAME_ID})=i;`);
export const WALL_EDGE_CALL = /\(mc,n,1\)/;
export const wallEdgeClearPattern = (): RegExp => new RegExp(String.raw`if\((${GAME_ID})\(`);
export const wallEdgeMakePattern = (): RegExp => new RegExp(String.raw`(${GAME_ID})\(mc,n,1\)`);
export const WALL_EDGE_MODEL = /n=(\d+);/;
export const moveAttachedPattern = (): RegExp => new RegExp(
  String.raw`function (${GAME_ID})\(i,${GAME_ID},${GAME_ID}=0\)\s*\{\s*for\(var (${GAME_ID})=0;\2<attachments\.length`,
);
export const STEP_NAME = Object.freeze({
  attach: 'attach', water: 'water', doorTexture: 'door-texture', doorEdges: 'door-edges', lampLight: 'lamp-light', lampFlare: 'lamp-flare',
});
export const HOLDER_CLASS = 'veh_hh';
export const EDGE_SIDE = Object.freeze({ left: 'left', right: 'right' } as const);

export const LAMP_TAG = TAG.lamp;
export const LAMP_ATTR = Object.freeze({ x: 'x', y: 'y', power: 'power' });
export const SHAPE_SCRATCH: readonly string[] = Object.freeze(['g', 'alphas']);
export const lampArrayPattern = (attr: string): RegExp => new RegExp(String.raw`(${GAME_ID})\[${GAME_ID}\]=(?:Math\.min\()?parseFloat\(b\["#${attr}"\]\)`);
export const lampStatePattern = (): RegExp => new RegExp(String.raw`(${GAME_ID})\[(${GAME_ID})\]=2;`);
export const flareListPattern = (): RegExp => new RegExp(String.raw`(${GAME_ID})\[${GAME_ID}\]=graphics_3d_front\.addChildAt\(new lens_flare`);
export const functionPattern = (): RegExp => new RegExp(String.raw`function (${GAME_ID})\(`, 'g');

export const DEFAULT_MATERIAL = '0';
export const VISIBLE_VALUE = 'true';

export const ACTION_ATTR_PATTERN = /^actions_\d+_(type|targetA|targetB)$/;
export const ACTION_PART = Object.freeze({ type: 'type', targetA: 'targetA', targetB: 'targetB' });
export const triggerActionAttr = (slot: number, part: string): string => `actions_${slot}_${part}`;
export const EMPTY_ACTION_TYPE = '-1';
export const ANY_ATTR = '*';
export const DETACHED_VALUES: readonly string[] = Object.freeze(['', '-1']);
export const DISPLAY_PROPERTY = Object.freeze({ x: 'x', y: 'y', rotation: 'rotation', scaleX: 'scaleX', scaleY: 'scaleY' });
export const UNREAD_ATTRS: readonly string[] = Object.freeze(['x', 'y']);
export const PLACE_AND_SIZE: readonly string[] = Object.freeze(['x', 'y', 'w', 'h']);
export const LAMP_LIVE_ATTRS: readonly string[] = Object.freeze(['uid', 'x', 'y', 'power', 'flare']);
export const PUSHER_FIELDS = Object.freeze({ tox: 'tox', toy: 'toy', stab: 'stab', damage: 'damage' });
export const TRUE_VALUE = 'true';
export const TRUE_VALUES: readonly string[] = Object.freeze(['true', '1']);
export const LIVE_SUPPORT = Object.freeze({ direct: 'direct', rebuild: 'rebuild' });

export const ATTRIBUTE_NAME = /^[A-Za-z0-9_]+$/;
export const DOUBLE_QUOTE = '"';
export const NUMBER_ATTRS: ReadonlySet<string> = new Set(['x', 'y', 'w', 'h', 'tox', 'toy']);
export const SAVE_NAME = /^[A-Za-z0-9 _.-]{1,60}$/;
export const SAVE_METHOD = 'POST';
export const liveKey = (tag: string, index: number | undefined): string => `${tag}#${index}`;
export const saveUrl = (route: string, name: string, overwrite: boolean): string => `${route}?name=${encodeURIComponent(name)}${overwrite ? '&overwrite=1' : ''}`;
