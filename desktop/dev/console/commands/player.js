// Commands that act on you or another character: heal, hp, revive, chars, pos, tp.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural, isNumberText, parseIndex, capitalize } from '../core/text.js';
import { takeOptions } from '../core/args.js';
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { movePlayerTo } from '../game/teleport.js';
import {
  player, isActive, requireLevel, isDown, charAt, charLabel, be, noCharacter, resolveChar,
} from '../game/level.js';
import { KEY, CLIENT_ONLY_REASON } from '../state/schema.js';
import { settings, binds } from '../state/store.js';
import { hpBonusFor, hpBonusAppliedTo } from '../overrides/frame.js';
import { setKey, unsetKey, runKey } from './settings.js';
import { bindKey, unbindKey } from '../../../../src/features/binds/index.ts';

// ----- hp -----

const HP_CHANGE = /^[+-]\d+(\.\d+)?%?$/; // hp +100, hp -25%
const HP_PERCENT_NO_SIGN = /^\d+(\.\d+)?%$/;

const signed = (n) => `${n > 0 ? '+' : ''}${n}`;

// With max_hp set, a change moves that value; otherwise it changes hp_bonus or
// hp_bonus_pct, which the frame loop adds to each character exactly once.
function changeHp(raw) {
  const pct = raw.endsWith('%');
  const n = Number(pct ? raw.slice(0, -1) : raw);
  if (settings.has(KEY.MAX_HP)) {
    const max = settings.get(KEY.MAX_HP);
    setKey(KEY.MAX_HP, Math.max(1, Math.round(pct ? max * (1 + n / 100) : max + n)));
    return;
  }
  const key = pct ? KEY.HP_BONUS_PCT : KEY.HP_BONUS;
  const next = Math.round(((settings.effective(key) ?? 0) + n) * 1000) / 1000;
  if (next === 0) unsetKey(key, ' (removed)');
  else setKey(key, next);
  if (!isActive()) return;
  const p = player();
  const base = p[F.MAX_HP] - hpBonusAppliedTo(p);
  const flat = settings.effective(KEY.HP_BONUS) ?? 0;
  const pc = settings.effective(KEY.HP_BONUS_PCT) ?? 0;
  const parts = [flat && signed(flat), pc && `${signed(pc)}%`].filter(Boolean).join(' ') || 'none';
  print(`  max HP ${Math.round(p[F.MAX_HP])} -> ${Math.round(Math.max(1, base + hpBonusFor(base)))} (game ${Math.round(base)}, bonus ${parts})`, COLOR.hint);
}

// ----- revive -----

const DEFAULT_MAX_HP = 100; // for a character whose max HP cannot be read
const MIN_PART_HP = 30;
// The game sets HP to this x power when reviving, so power = max HP / this gives full HP.
const REVIVE_HP_PER_POWER = 10;
// Body parts: HP field, "broken" flag, share of max HP the game gives the part at spawn
// (the character constructor, frame2.js ~7768). The game never revives a character
// whose head is destroyed (the first two broken), so those are repaired first.
const BODY = Object.freeze([
  [F.HEAD_HP, F.HEAD_OFF, 0.4], // head blown off (headshot, gib)
  [F.FACE_HP, F.FACE_GONE, 0.6], // head destroyed
  [F.LEGS_HP, F.LEGS_BROKEN, 0.5], // lower body broken
  [F.ARMS_HP, F.ARMS_BROKEN, 0.4], // arms broken
]);

const maxHpOf = (c) => Number(c[F.MAX_HP]) || DEFAULT_MAX_HP;

// Gives every body part its spawn HP back and lets the game restore the visuals.
function repairBody(i, c) {
  let broken = 0;
  const hp = Math.max(maxHpOf(c), 1);
  for (const [part, flag, share] of BODY) {
    if (c[flag] === true) broken++;
    if (!(c[part] > 0) || c[flag] === true) c[part] = Math.max(hp * share, MIN_PART_HP);
  }
  if (broken) game.updateBody(i);
  return broken;
}

// Revives character i to full HP the way a defibrillator does: stands the body up where
// it lies, clears the dead/dying flags, re-equips. Returns false when it was not down.
function reviveChar(i) {
  const c = charAt(i);
  if (!c) throw noCharacter(i);
  if (!isDown(c)) return false;
  const repaired = repairBody(i, c);
  if (repaired) print(`  repaired ${plural(repaired, 'broken body part')}`, COLOR.hint);
  game.healChar(i, c, Math.max(1, maxHpOf(c) / REVIVE_HP_PER_POWER));
  if (isDown(c)) {
    const still = BODY.filter(([, flag]) => c[flag] === true).length;
    throw new Error(`the game refused to revive #${i}${still ? ` (${plural(still, 'body part')} still broken)` : ''}`);
  }
  return true;
}

// Dying in single-player sets the level to 'failed' and fades to black. Undo that once
// you are alive again, so the level keeps going instead of ending.
const LEVEL_FAILED = 'failed';
function cancelLevelFailed() {
  if (game.isMP() || game.levelState() !== LEVEL_FAILED || isDown(player())) return;
  const fade = game.fadeOverlay();
  const pausedByFade = fade && fade.alpha >= 1 && !game.isRunning();
  game.setLevelState('');
  game.setFailText('');
  if (fade) { fade.alpha = 0; fade.visible = false; }
  if (pausedByFade) game.setRunning(true);
  print('  level failure cancelled', COLOR.hint);
}

function revive(rawArgs) {
  requireLevel();
  const { options, rest: args } = takeOptions(rawArgs, ['all']);
  const usage = 'usage: revive  |  revive <#>  |  revive --all';
  if (args.length > 1 || (options.size && args.length)) throw new Error(usage);
  const a = (args[0] || '').toLowerCase();
  if (options.has('all') || a === 'all') {
    let n = 0;
    for (let i = 0; i < game.charCount(); i++) {
      const c = game.chars()[i];
      if (c && c.io && isDown(c)) { try { if (reviveChar(i)) n++; } catch (e) { print(`  #${i}: ${e.message}`, COLOR.error); } }
    }
    print(n ? `Revived ${plural(n, 'character')}` : 'Nobody is down', n ? COLOR.ok : COLOR.notice);
    cancelLevelFailed();
    return;
  }
  const me = game.me();
  let i = me;
  if (a) {
    i = parseIndex(a);
    if (i === null) throw new Error(usage);
  }
  const who = i === me ? 'you' : charLabel(i);
  if (!reviveChar(i)) { print(`${capitalize(be(who))} not down`, COLOR.notice); return; }
  print(`Revived ${who} (HP ${Math.round(game.chars()[i][F.HP])})`, COLOR.ok);
  cancelLevelFailed();
}

// ----- teleport -----

function teleportTo(tx, ty, label) {
  requireLevel();
  if (!(player()[F.HP] > 0)) throw new Error('you are dead');
  movePlayerTo(tx, ty);
  print(`Teleported to ${label ? label + ' at ' : ''}${Math.round(tx)}, ${Math.round(ty)}`, COLOR.ok);
}

// The game's aim target, in world units.
function teleportToCrosshair() {
  requireLevel();
  const p = player();
  if (!Number.isFinite(p.tarx) || !Number.isFinite(p.tary)) throw new Error('crosshair position unknown');
  teleportTo(p.tarx, p.tary);
}

function teleportToChar(q) {
  requireLevel();
  const i = resolveChar(q);
  if (i === game.me()) throw new Error('that is you');
  const t = game.chars()[i];
  const ref = t[F.REF_PT];
  const x = game.ptX()[ref], y = game.ptY()[ref];
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`could not read the position of #${i}`);
  teleportTo(x, y, charLabel(i, t));
}

const TP_OPTION = Object.freeze({ ON: 'on', OFF: 'off' });

function tp(rawArgs) {
  const { options, rest: args, literal } = takeOptions(rawArgs, Object.values(TP_OPTION));
  // The old hotkey syntax, now a bind.
  if (options.has(TP_OPTION.ON)) {
    if (options.has(TP_OPTION.OFF) || args.length !== 1) throw new Error('usage: bind <key> tp   e.g. bind f tp');
    bindKey([args[0], 'tp']);
    return;
  }
  if (options.has(TP_OPTION.OFF)) {
    if (args.length) throw new Error('usage: tp --off   (unbinds every key bound to "tp")');
    const keys = binds.boundTo('tp');
    if (!keys.length) { print('No key is bound to "tp"', COLOR.notice); return; }
    for (const k of keys) unbindKey([k]);
    return;
  }
  if (!args.length) { teleportToCrosshair(); return; }
  // After "--", "tp -- 1 2" is a character named "1 2".
  if (!literal && args.length === 2 && isNumberText(args[0]) && isNumberText(args[1])) { teleportTo(Number(args[0]), Number(args[1])); return; }
  // Anything else is a character: tp 2 | tp #2 | tp bot | tp to <name>
  const who = !literal && args.length > 1 && args[0].toLowerCase() === 'to' ? args.slice(1) : args;
  try {
    teleportToChar(who.join(' '));
  } catch (e) {
    // "tp on f" / "tp off" were keywords once.
    const old = Object.values(TP_OPTION).find((o) => o === who[0].toLowerCase());
    if (old && !literal && /^no character named/.test(e.message)) throw new Error(`${e.message.replace(/ Type "chars"\.$/, '')} For the old hotkey syntax, type "tp --${old}${who.length > 1 ? ' ' + who.slice(1).join(' ') : ''}".`);
    throw e;
  }
}

// ----- chars, pos -----

function chars() {
  requireLevel();
  const c = game.chars();
  const me = game.me();
  const p0 = player();
  for (let i = 0; i < game.charCount(); i++) {
    const p = c[i];
    if (!p || !p.io) continue;
    const hp = `${Math.round(p[F.HP])}/${Math.round(p[F.MAX_HP])}`;
    const dist = Math.round(Math.hypot(p.x - p0.x, p.y - p0.y));
    const tag = i === me ? ' (you)' : p.team === p0.team ? ' ally' : ' enemy';
    print(`  #${String(i).padEnd(3)} ${String(p.nickname || '-').padEnd(16)} team ${String(p.team).padEnd(3)} hp ${hp.padEnd(11)} ${p[F.HP] > 0 ? 'alive' : 'dead '} ${String(dist).padStart(6)}px${tag}`,
      i === me ? COLOR.ok : undefined);
  }
}

function pos() {
  requireLevel();
  const p = player();
  const ref = p[F.REF_PT];
  print(`you: ${Math.round(game.ptX()[ref])}, ${Math.round(game.ptY()[ref])}   crosshair: ${Math.round(p.tarx)}, ${Math.round(p.tary)}`);
}

export const playerCommands = [
  {
    name: 'heal',
    usage: 'heal',
    desc: 'Refill HP',
    clientOnly: CLIENT_ONLY_REASON,
    help: {
      about: [
        'Refills your HP to your current max. Needs a level, and refuses while you',
        'are down, because the body has to be stood up first ("revive").',
      ],
      see: ['revive', 'hp', 'max_hp'],
    },
    run: () => {
      const p = player();
      requireLevel();
      if (isDown(p)) throw new Error('you are down; use "revive"');
      p[F.HP] = p[F.MAX_HP];
      print(`HP = ${p[F.MAX_HP]}`, COLOR.ok);
    },
  },
  {
    name: 'hp',
    usage: 'hp <n> | hp +n | hp -n%',
    desc: 'Set max HP to n, or add/remove n or n% once (no stacking per frame or per level)',
    clientOnly: CLIENT_ONLY_REASON,
    help: {
      about: [
        'Three things in one, all of them keys underneath:',
        '  hp <n>     sets max_hp, an exact max HP',
        '  hp +n      adds a flat bonus (hp_bonus)',
        '  hp +n%     adds a percentage of the game\'s own max (hp_bonus_pct)',
        'A bonus applies once per life and per level, so it never stacks. While max_hp',
        'is set, "hp +n" raises that number instead of the bonus.',
      ],
      examples: [
        ['hp 500', 'max HP is exactly 500'],
        ['hp +100', '100 more than the map gives you'],
        ['hp -25%', 'a quarter less'],
        ['hp +0', 'back to no bonus (removes the key)'],
      ],
      notes: [
        'A relative change needs its sign: "hp 50%" is refused, "hp +50%" is not.',
      ],
      see: ['max_hp', 'hp_bonus', 'hp_bonus_pct', 'heal'],
    },
    run: (args) => {
      if (args.length === 1 && HP_CHANGE.test(args[0])) { changeHp(args[0]); return; }
      if (args.length === 1 && HP_PERCENT_NO_SIGN.test(args[0])) throw new Error(`use a sign: "hp +${args[0]}" or "hp -${args[0]}"`);
      runKey(KEY.MAX_HP, args);
    },
  },
  {
    name: 'revive',
    aliases: ['res'],
    usage: 'revive [# | --all]',
    desc: 'Revive yourself, character # (see "chars"), or every dead character',
    clientOnly: CLIENT_ONLY_REASON,
    help: {
      about: [
        'Stands the body up where it lies and refills HP, the way a defibrillator',
        'does. A destroyed head is repaired first, because the game refuses to revive',
        'without one. Also cancels the "level failed" screen.',
      ],
      args: [
        ['(nothing)', 'you'],
        ['<#>', 'a character index from "chars"'],
        ['--all', 'everyone who is down ("all" works too)'],
      ],
      examples: [
        ['revive', 'yourself'],
        ['revive 3', 'character #3'],
        ['revive --all', 'every downed character'],
      ],
      see: ['chars', 'heal'],
    },
    run: revive,
  },
];

// tp, pos and chars come after guns in the help overview.
export const tpCommand = {
  name: 'tp',
  aliases: ['teleport'],
  usage: 'tp [x y | # | name]',
  desc: 'Teleport to the crosshair, to x y (see "pos"), or to a character (see "chars")',
  clientOnly: CLIENT_ONLY_REASON,
  help: {
    about: [
      'With no argument: to your crosshair.',
    ],
    args: [
      ['x y', 'exact coordinates (see "pos")'],
      ['<# | name>', 'to a character, by index or part of a nickname'],
      ['to <name>', 'the same, when the name could be read as something else'],
      ['-- <name>', 'everything after "--" is the name: "tp -- 1 2" is a player named "1 2"'],
      ['--on <key>', 'the old hotkey syntax: the same as "bind <key> tp"'],
      ['--off', 'unbind every key bound to "tp"'],
    ],
    examples: [
      ['tp', 'to the crosshair'],
      ['tp 1200 -400', 'to those coordinates'],
      ['tp 3', 'to character #3'],
      ['tp to bob', 'to the first nickname containing "bob"'],
      ['bind f tp', 'teleport to the crosshair with F'],
    ],
    notes: [
      'Words that are not options are a character, so "tp off" goes to a player named "off".',
    ],
    see: ['pos', 'chars', 'bind'],
  },
  run: tp,
};

export const posCommand = {
  name: 'pos',
  aliases: ['where'],
  usage: 'pos',
  desc: 'Show your position and the crosshair position',
  help: {
    about: [
      'Your coordinates and your crosshair\'s, both rounded. Feed them to "tp x y".',
    ],
    see: ['tp'],
  },
  run: pos,
};

export const charsCommand = {
  name: 'chars',
  aliases: ['players', 'bots'],
  usage: 'chars',
  desc: 'List characters: #, name, team, HP, distance',
  help: {
    about: [
      'Everyone in the level: index, nickname, team, HP, alive or dead, and how',
      'far away they are. The index is what "tp", "give to", "drop from" and',
      '"triggers run as" take.',
    ],
    see: ['tp', 'give', 'revive'],
  },
  run: chars,
};
