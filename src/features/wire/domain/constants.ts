import { CHANNEL, DEFAULT_RULE as RULE, FIELD_KIND as KIND, VAR_SYNC_MODE } from '../keys.ts';
import { SCALE } from '../constants.ts';
import type { Message } from './types.ts';

const RECEIVE_ONLY = 'the server sends this to clients; a client does not originate it';
const RESERVED = 'reserved: nothing sends it';

export const MESSAGES: readonly Message[] = Object.freeze([
  { name: 'RESPONSE', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'answering side -> asking side', note: 'an answer, never originated by hand', fields: [] },
  {
    name: 'EXEC_TRIGGER', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'trigger', kind: KIND.number, default: RULE.zero, desc: 'the trigger index in the map' },
      { name: 'region', kind: KIND.number, default: RULE.empty, desc: 'a region index, or empty' },
      { name: 'power', kind: KIND.decimal, scale: SCALE.hundredth, default: RULE.empty, desc: 'activation power' },
    ],
  },
  {
    name: 'RESPAWN', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every client',
    fields: [
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'spawn x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'spawn y' },
      { name: 'hp', kind: KIND.number, default: RULE.myHmax, desc: 'the HP to set' },
      { name: 'respawns', kind: KIND.number, default: RULE.zero, desc: 'the respawn counter; the server overwrites it' },
    ],
  },
  { name: 'GRENADE_THROW', channel: CHANNEL.match, sendable: false, reply: false, direction: 'reserved', note: RESERVED, fields: [] },
  {
    name: 'HIT_PLAYER', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'victim', kind: KIND.slot, default: RULE.aim, desc: 'the victim slot' },
      { name: 'limb', kind: KIND.number, default: RULE.zero, desc: 'body part: 0, 1, 2 or 3' },
      { name: 'power', kind: KIND.decimal, scale: SCALE.hundredth, default: RULE.zero, desc: 'projectile power' },
      { name: 'knockback', kind: KIND.decimal, scale: SCALE.hundredth, default: RULE.zero, desc: 'knockback multiplier' },
      { name: 'frame', kind: KIND.number, default: RULE.zero, desc: 'projectile animation frame' },
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'hit x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'hit y' },
      { name: 'spx', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'projectile velocity x' },
      { name: 'spy', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'projectile velocity y' },
      { name: 'cclass', kind: KIND.number, default: RULE.zero, desc: 'projectile class' },
      { name: 'source', kind: KIND.number, default: RULE.myGun, desc: 'the weapon' },
      { name: 'atom', kind: KIND.number, default: RULE.zero, desc: 'body segment index' },
      { name: 'damage', kind: KIND.decimal, scale: SCALE.hundredth, default: RULE.zero, desc: 'claimed HP lost' },
      { name: 'respawns', kind: KIND.number, default: RULE.targetRespawns, desc: "the victim's respawn counter" },
    ],
  },
  {
    name: 'DAMAGE_PLAYERS_VIA_EXPLOSION', channel: CHANNEL.match, sendable: true, reply: true, direction: 'client -> match server -> every other client',
    fields: [{ name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' }],
    group: [
      { name: 'victim', kind: KIND.slot, default: RULE.area, desc: 'a victim slot' },
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'blast x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'blast y' },
      { name: 'tox', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'push x' },
      { name: 'toy', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'push y' },
      { name: 'stability', kind: KIND.decimal, scale: SCALE.hundredth, default: RULE.zero, desc: 'stability damage' },
      { name: 'damage', kind: KIND.number, default: RULE.zero, desc: 'HP lost' },
      { name: 'hpHead', kind: KIND.number, default: RULE.zero, desc: 'head HP lost' },
      { name: 'hpArms', kind: KIND.number, default: RULE.zero, desc: 'arms HP lost' },
      { name: 'hpLegs', kind: KIND.number, default: RULE.zero, desc: 'legs HP lost' },
      { name: 'hpBody', kind: KIND.number, default: RULE.zero, desc: 'body HP lost' },
      { name: 'source', kind: KIND.number, default: RULE.myGun, desc: 'the weapon' },
      { name: 'respawns', kind: KIND.number, default: RULE.targetRespawns, desc: "the victim's respawn counter" },
      { name: 'atoms', kind: KIND.number, default: RULE.zero, desc: 'atom count; 0 means no atom tail' },
    ],
  },
  {
    name: 'HEAL_PLAYER', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'power', kind: KIND.decimal, scale: SCALE.hundredth, default: RULE.zero, desc: 'heal power' },
      { name: 'gun', kind: KIND.number, default: RULE.myGun, desc: "the healer's gun index" },
      { name: 'target', kind: KIND.slot, default: RULE.aim, desc: 'the target slot' },
      { name: 'respawns', kind: KIND.number, default: RULE.targetRespawns, desc: "the target's respawn counter" },
    ],
  },
  {
    name: 'PROJECTILE_CREATE', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [{ name: 'gun', kind: KIND.number, default: RULE.myGun, desc: 'gun index, or -1/-2/-3 for a grenade' }],
    group: [
      { name: 'number', kind: KIND.number, default: RULE.zero, desc: 'projectile number' },
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'start x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'start y' },
      { name: 'angle', kind: KIND.decimal, scale: SCALE.thousandth, default: RULE.zero, desc: 'angle in radians' },
    ],
  },
  {
    name: 'PROJECTILE_REMOVE', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'number', kind: KIND.number, default: RULE.zero, desc: 'the projectile number' },
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'end x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'end y' },
    ],
  },
  {
    name: 'BARREL', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'barrel', kind: KIND.number, default: RULE.zero, desc: 'barrel index' },
      { name: 'hp', kind: KIND.number, default: RULE.zero, desc: 'barrel HP after the hit' },
      { name: 'byPlayer', kind: KIND.flag, default: RULE.empty, desc: '"1" if a player or bot caused it' },
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: "the barrel's x" },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: "the barrel's y" },
    ],
  },
  {
    name: 'THROW_GUN', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'gun', kind: KIND.number, default: RULE.myGun, desc: 'gun index' },
      { name: 'x1', kind: KIND.number, default: RULE.myPosX, desc: 'first node x' },
      { name: 'y1', kind: KIND.number, default: RULE.myPosY, desc: 'first node y' },
      { name: 'sx1', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'first node velocity x' },
      { name: 'sy1', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'first node velocity y' },
      { name: 'x2', kind: KIND.number, default: RULE.myPosX, desc: 'second node x' },
      { name: 'y2', kind: KIND.number, default: RULE.myPosY, desc: 'second node y' },
      { name: 'sx2', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'second node velocity x' },
      { name: 'sy2', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'second node velocity y' },
    ],
  },
  {
    name: 'HIT_GRENADE', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'grenade', kind: KIND.number, default: RULE.zero, desc: 'grenade projectile id' },
      { name: 'shot', kind: KIND.number, default: RULE.zero, desc: 'shot projectile id' },
      { name: 'tox', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'push x' },
      { name: 'toy', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'push y' },
    ],
  },
  { name: 'PLAYER_DIES', channel: CHANNEL.match, sendable: false, reply: false, direction: 'match server -> every client', note: RECEIVE_ONLY, fields: [] },
  {
    name: 'HIT_SHIELD', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'shield', kind: KIND.number, default: RULE.zero, desc: 'shield projectile id' },
      { name: 'hpBefore', kind: KIND.number, default: RULE.zero, desc: 'shield HP before the hit' },
      { name: 'damage', kind: KIND.number, default: RULE.zero, desc: 'damage dealt' },
      { name: 'owner', kind: KIND.slot, default: RULE.aim, desc: 'the slot that owns the shield' },
    ],
  },
  {
    name: 'CHAT', channel: CHANNEL.lobby, sendable: true, reply: false, direction: "client -> lobby -> every client in the sender's match",
    fields: [
      { name: 'destination', kind: KIND.number, default: RULE.zero, desc: '1 everyone, 2 team' },
      { name: 'text', kind: KIND.text, desc: 'the message text' },
    ],
  },
  {
    name: 'CREATE_MATCH', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client -> lobby',
    fields: [
      { name: 'settings', kind: KIND.json, desc: 'the match settings object' },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
    ],
  },
  {
    name: 'AUTHENTICATE', channel: CHANNEL.lobby, sendable: true, reply: true, force: true, direction: 'client -> lobby',
    note: 're-logs the connection; needs --force',
    fields: [
      { name: 'login', kind: KIND.text, default: RULE.empty, desc: 'login' },
      { name: 'password', kind: KIND.text, default: RULE.empty, desc: 'password' },
      { name: 'version', kind: KIND.text, default: RULE.empty, desc: 'game version' },
      { name: 'hash', kind: KIND.text, default: RULE.empty, desc: 'build hash' },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
      { name: 'nickname', kind: KIND.text, default: RULE.empty, desc: 'campaign nickname' },
      { name: 'device', kind: KIND.text, default: RULE.empty, desc: 'device id, JSON-quoted' },
      { name: 'build', kind: KIND.text, default: RULE.empty, desc: 'build timestamp' },
    ],
  },
  { name: 'LIST_ME_AS_HOST', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'reserved', note: RESERVED, fields: [] },
  { name: 'SERVICE_MESSAGE', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'lobby -> client', note: RECEIVE_ONLY, fields: [] },
  {
    name: 'GET_MATCH_LIST', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client -> lobby',
    fields: [
      { name: 'filter', kind: KIND.json, default: RULE.empty, desc: 'filter object, or {}' },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
      { name: 'view', kind: KIND.choice, choices: Object.freeze(['match_list', 'relations', 'skill_board']), desc: 'which list' },
    ],
  },
  {
    name: 'JOIN_MATCH', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client -> lobby',
    fields: [
      { name: 'uid', kind: KIND.number, default: RULE.zero, desc: 'match uid, or -1 to leave' },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
      { name: 'slot', kind: KIND.number, default: RULE.zero, desc: '-1 any slot, -100 spectator, or a slot' },
      { name: 'wantMap', kind: KIND.flag, default: RULE.empty, desc: '"1" to receive the map' },
      { name: 'password', kind: KIND.text, default: RULE.empty, desc: 'match password' },
    ],
  },
  { name: 'MATCH_JOIN_RESPONSE', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'lobby -> client', note: RECEIVE_ONLY, fields: [] },
  { name: 'MAP_CHUNK', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'lobby -> client', note: RECEIVE_ONLY, fields: [] },
  {
    name: 'CLIENT_READY_FOR_FIRST_SYNC', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client -> lobby',
    fields: [{ name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' }],
  },
  { name: 'FIRST_SYNC_RESPONSE', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'lobby -> client', note: RECEIVE_ONLY, fields: [] },
  {
    name: 'MY_PLAYER_PROPERTIES_CHANGED', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    note: 'pairs of property index and JSON value; the whitelist is team, skin_snapshot, slot0..slot9, curwea',
    fields: [
      { name: 'property', kind: KIND.number, default: RULE.zero, desc: 'property index 0..12' },
      { name: 'value', kind: KIND.json, desc: 'the new value' },
    ],
  },
  {
    name: 'PING', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'lobby -> client, answered; client sends only the scan report',
    note: 'the lobby drops a client PING that is not the anti-tamper report', fields: [],
  },
  {
    name: 'REPORT_USER', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client -> lobby',
    fields: [
      { name: 'target', kind: KIND.authId, default: RULE.aim, desc: "the target's auth id" },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
    ],
  },
  {
    name: 'ENDORDSE_USER', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client -> lobby',
    fields: [
      { name: 'target', kind: KIND.authId, default: RULE.aim, desc: "the target's auth id" },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
    ],
  },
  {
    name: 'KICK_USER', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client (match owner or staff) -> lobby',
    fields: [
      { name: 'target', kind: KIND.authId, default: RULE.aim, desc: "the target's auth id" },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
      { name: 'allGuests', kind: KIND.flag, default: RULE.empty, desc: '"1" to also bar the shared guest uid' },
    ],
  },
  { name: 'MATCH_INFO_PARTIAL_UDPATE', channel: CHANNEL.match, sendable: false, reply: false, direction: 'match server -> every client in the match', note: RECEIVE_ONLY, fields: [] },
  { name: 'PLAYER_SCORE_UPDATE', channel: CHANNEL.match, sendable: false, reply: false, direction: 'match server -> every client in the match', note: RECEIVE_ONLY, fields: [] },
  { name: 'PLAY_SOUND', channel: CHANNEL.match, sendable: false, reply: false, direction: 'match server -> client', note: RECEIVE_ONLY, fields: [] },
  {
    name: 'BAN_USER', channel: CHANNEL.lobby, sendable: true, reply: true, direction: 'client (staff) -> lobby',
    fields: [
      { name: 'target', kind: KIND.authId, default: RULE.aim, desc: "the target's auth id" },
      { name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' },
    ],
  },
  {
    name: 'RESSURECT', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every client',
    fields: [
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'y' },
      { name: 'hp', kind: KIND.number, default: RULE.myHmax, desc: 'the HP to set' },
      { name: 'respawns', kind: KIND.number, default: RULE.zero, desc: 'the respawn counter; the server overwrites it' },
    ],
  },
  { name: 'SWORD_ATTACK', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client', fields: [] },
  {
    name: 'VAR_SYNC', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'mode', kind: KIND.choice, choices: VAR_SYNC_MODE, desc: 'merge mode: r, d, x, n or l' },
      { name: 'name', kind: KIND.text, desc: 'the variable name' },
      { name: 'value', kind: KIND.text, desc: 'the value, as text' },
    ],
  },
  {
    name: 'FLOW_AT', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'burst x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'burst y' },
      { name: 'type', kind: KIND.number, default: RULE.zero, desc: 'effect type' },
      { name: 'vx', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'drop velocity x' },
      { name: 'vy', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'drop velocity y' },
      { name: 'count', kind: KIND.number, default: RULE.zero, desc: 'how many times it repeats' },
    ],
  },
  {
    name: 'AI_STATE_SYNC', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'slot', kind: KIND.slot, default: RULE.aim, desc: "the bot's slot" },
      { name: 'hp', kind: KIND.number, default: RULE.zero, desc: 'HP' },
      { name: 'x', kind: KIND.number, default: RULE.myPosX, desc: 'x' },
      { name: 'y', kind: KIND.number, default: RULE.myPosY, desc: 'y' },
      { name: 'tox', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'velocity x' },
      { name: 'toy', kind: KIND.decimal, scale: SCALE.fifth, default: RULE.zero, desc: 'velocity y' },
      { name: 'tarx', kind: KIND.number, default: RULE.zero, desc: 'aim x' },
      { name: 'tary', kind: KIND.number, default: RULE.zero, desc: 'aim y' },
      { name: 'hunt', kind: KIND.number, default: RULE.zero, desc: 'the slot it hunts, -1 none' },
      { name: 'action', kind: KIND.number, default: RULE.zero, desc: 'action code' },
      { name: 'rand', kind: KIND.decimal, scale: SCALE.thousandth, default: RULE.zero, desc: 'random value' },
      { name: 'rand2', kind: KIND.decimal, scale: SCALE.thousandth, default: RULE.zero, desc: 'random value' },
      { name: 'rand3', kind: KIND.decimal, scale: SCALE.thousandth, default: RULE.zero, desc: 'random value' },
      { name: 'randtim', kind: KIND.number, default: RULE.zero, desc: 'timer for the random values' },
    ],
  },
  {
    name: 'AI_HEALTH_SYNC', channel: CHANNEL.match, sendable: true, reply: false, direction: 'client -> match server -> every other client',
    fields: [
      { name: 'slot', kind: KIND.slot, default: RULE.aim, desc: "the bot's slot" },
      { name: 'hp', kind: KIND.number, default: RULE.zero, desc: 'HP' },
      { name: 'head', kind: KIND.number, default: RULE.zero, desc: 'head HP' },
      { name: 'body', kind: KIND.number, default: RULE.zero, desc: 'body HP' },
      { name: 'arms', kind: KIND.number, default: RULE.zero, desc: 'arms HP' },
      { name: 'legs', kind: KIND.number, default: RULE.zero, desc: 'legs HP' },
    ],
  },
  { name: 'TASK', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'lobby -> client', note: RECEIVE_ONLY, fields: [] },
  { name: 'TASK_ASNYC', channel: CHANNEL.lobby, sendable: false, reply: false, direction: 'lobby -> client', note: RECEIVE_ONLY, fields: [] },
  { name: 'YOU_ARE_STILL_DEAD', channel: CHANNEL.match, sendable: false, reply: false, direction: 'match server -> client', note: RECEIVE_ONLY, fields: [] },
  {
    name: 'ENTER_RESPAWN_QUEUE', channel: CHANNEL.match, sendable: true, reply: true, direction: 'client -> match server',
    fields: [{ name: 'reply', kind: KIND.text, default: RULE.replyId, desc: 'reply id, filled in' }],
  },
]);

export const MESSAGE_BY_NAME: ReadonlyMap<string, Message> = new Map(MESSAGES.map((message) => [message.name, message]));
