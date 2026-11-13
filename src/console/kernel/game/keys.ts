export const CONNECTION_CLASS_NAME = 'connClass';

export const NAME_KEYS = Object.freeze([
  'chars', 'me', 'dead', 'dying', 'updateBody', 'charCount', 'refreshChar', 'healChar', 'headHp', 'faceHp',
  'legsHp', 'armsHp', 'headOff', 'faceGone', 'legsBroken', 'armsBroken', 'jump', 'walk', 'playerDt', 'noSwords', 'moveIntentX', 'moveIntentY', 'stability',
  'ptCount', 'ptOwner', 'charIndex', 'gunPtBase', 'gunPtRange', 'guns', 'ptX', 'ptY', 'interpolating', 'ptPrevX',
  'ptPrevY', 'clearPtInterp', 'cameraTarget', 'spectating', 'refPoint', 'effect', 'effectTypes', 'effectTeleport',
  'afterMove', 'gunFactory', 'strDecode', 'gunName', 'gunSlot', 'gunFixed', 'gunPellets', 'gunSpread', 'gunBloom',
  'gunRate', 'gunRecoil', 'wakePt', 'gunPtA', 'gunPtB', 'ptVelX', 'aimAngle', 'ptVelY', 'facing', 'bullets',
  'bulletDamage', 'bulletLife', 'bulletOwner', 'triggers', 'triggerCount', 'trigEnabled', 'trigAtStart',
  'trigMaxCalls', 'trigCalls', 'trigActionCount', 'trigTargetA', 'trigTargetB', 'trigTypes', 'regions', 'regionCount',
  'regionTrigger', 'regionUseOn', 'regionUsesTimer', 'charVehicle', 'charHuman', 'timers', 'timerCount',
  'triggerActivator', 'triggerPower', 'runTrigger', 'resolveTarget', 'decors', 'wallX', 'wallCount', 'wallY',
  'wallW', 'wallH', 'wallMaterial', 'gridCell', 'grid', 'gridCols', 'gridRows', 'gridMinX', 'gridMinY', 'gridAddWall',
  'doors', 'doorCount', 'bgX', 'bgCount', 'bgY', 'bgW', 'bgH', 'bgShadow', 'pushX1', 'pushCount', 'pushY1',
  'pushX2', 'pushY2', 'pushToX', 'pushToY', 'pushStab', 'pushDamage', 'waters', 'waterCount', 'waterX', 'waterY',
  'waterW', 'waterH', 'waterDamage', 'displayInit', 'textureFollows', 'net', 'netNum', 'lobbyConn', 'netSend',
  'netLog', 'connRecv', 'connPeer', 'connReason', 'netDigits', 'netTypeNames', 'buildTag', 'p2pConn', 'netChannel',
  'netReplyTo', 'enterMatch', 'spectatorSlots', 'matchSlots', 'connUser', 'connStats', 'p2pAuth', 'p2pAuthIds',
  'connPlayer', 'connSpectator', 'connSay', 'matchSetMap', 'acceptManually', 'createSettings', 'joinPassword',
  'lobbyReady', 'spectatorSlot', 'chatToAll', 'chatTrace', 'stateHp', 'stateRespawns', 'stateAimX', 'stateAimY',
  'stateHeadHp', 'stateFaceHp', 'stateX', 'stateY', 'stateKiller', 'stateClock', 'stateVelScale', 'connClass',
  'serverFlag', 'setupClass', 'setupMethod', 'serverStats', 'webRequests', 'webRequest', 'mapUrl', 'mapKey',
  'mapRequest', 'tickGuardBefore', 'tickGuardAfter', 'netTick', 'connClosed', 'socketConn', 'connDevice', 'deviceId', 'authLogin', 'authRecords',
  'authReport', 'authEndorse', 'authBan', 'authCheat', 'authLog', 'logDisconnect', 'logChat', 'logCreate',
  'logSpectate', 'logJoin', 'logLeave', 'matchEnd', 'matchExclude', 'connMatch', 'connListAt', 'matchSay', 'matchLoadMap',
  'serverLocation', 'lobbyHosts', 'lobbyPort', 'lockedArrays', 'mapText', 'mapChunks', 'levelStart', 'charOnDeath',
  'zoom', 'timerTarget', 'varSyncOn', 'mapVars', 'mapId', 'keyUp', 'keyDown', 'mp', 'chatTyping', 'customMap',
  'openChat', 'sayTrigger', 'chatPopups', 'chatPanel', 'chatPanelText', 'uiOverlay', 'levelState', 'failText',
  'fadeOverlay',
] as const);
export type NameKey = typeof NAME_KEYS[number] | 'version';

export const GAME_GLOBAL = Object.freeze({
  stage: 'stage',
  gravity: 'gravity',
  running: 'system_non_stop',
  guns: 'Guns',
  world: 'game',
  wallLayer: 'graphics_3d',
  frontLayer: 'graphics_3d_front',
  canvas: 'game_canvas',
  wallTexture: 'texture_front0',
  peer: 'SimplePeer',
  goToFrame: 'gotoAndStop',
  keyboardEvent: 'KeyboardEvent',
  event: 'Event',
  loaderInfo: 'loaderInfo',
} as const);

export const LEVEL_FRAME = 'gaming';
export const SADBURST_VERSION_PREFIX = 'sadburst-';
export const NAMES_NOT_LOADED = '(names.js not loaded)';
export const NAMES_FILE = Object.freeze({ official: 'data/names.js', sadburst: 'data/names.sadburst.js' });
export const NON_ASCII = /[\u0080-\uffff]/g;
export const FIND_NAMES_COMMAND = 'npm run find-names';
export const UNICODE_ESCAPE_PREFIX = '\\u';
export const HEX_RADIX = 16;
export const UNICODE_ESCAPE_DIGITS = 4;
export const ZERO_PAD = '0';
export const missingNameLabel = (key: string): string => `<${key}>`;
export const readerSource = (name: string): string => `(() => typeof ${name} === 'undefined' ? undefined : ${name})`;
export const writerSource = (name: string): string => `((value) => { ${name} = value; })`;

export const FIELD = Object.freeze({ hp: 'hea', maxHp: 'hmax' });
export const slotField = (slot: number): string => `slot${slot}`;
export const PICKED_BY = 'picken_by';

export const NET = Object.freeze({
  EXEC_TRIGGER: 'RELIABLE_EXEC_TRIGGER',
  VAR_SYNC: 'RELIABLE_VAR_SYNC',
  JOIN_MATCH: 'RELIABLE_JOIN_MATCH',
  GET_MATCH_LIST: 'RELIABLE_GET_MATCH_LIST',
  PING: 'RELIABLE_PING',
  CREATE_MATCH: 'RELIABLE_CREATE_MATCH',
  KICK_USER: 'RELIABLE_KICK_USER',
  CHAT: 'RELIABLE_CHAT',
});

export const STATE_KEYS = Object.freeze({
  hp: 'stateHp', respawns: 'stateRespawns', aimX: 'stateAimX', aimY: 'stateAimY', headHp: 'stateHeadHp',
  faceHp: 'stateFaceHp', x: 'stateX', y: 'stateY', killer: 'stateKiller', clock: 'stateClock', velScale: 'stateVelScale',
} as const);

export const LOCKED_NAMED = Object.freeze(['wallX', 'wallY', 'wallW', 'wallH', 'pushToX', 'pushToY', 'pushStab',
  'pushDamage', 'waterX', 'waterY', 'waterW', 'waterH', 'waterDamage'] as const);

export const ENTER = Object.freeze({ key: 'Enter', code: 'Enter' });
export const NO_EFFECT = 'none';
export const UNKNOWN_COUNT = '?';
export const SCRIPT_FRAME = '1';
export const GLOBAL_FLAG = 'g';
export const gunModelPattern = (decoderName: string): string => `${decoderName}\\((\\$[^,()]+),`;
export const gunSlotPattern = (slotField: string): string => `\\.${slotField}=(-?\\d+)`;

export const DRAW_OPERATION = Object.freeze({ moveTo: 'moveTo', lineTo: 'lineTo', beginBitmapFill: 'beginBitmapFill', endFill: 'endFill' } as const);
export const TRIM_EDGE = Object.freeze({ top: 'top', bottom: 'bottom' } as const);
export type TrimEdge = typeof TRIM_EDGE[keyof typeof TRIM_EDGE];

export const PLAYER_WORD = 'you';
