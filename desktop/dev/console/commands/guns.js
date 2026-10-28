// Gun commands: guns, give, drop.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { capitalize } from '../core/text.js';
import { game } from '../game/bindings.js';
import { F, GUN_SLOTS, FIRST_SLOT, LAST_SLOT, EMPTY_SLOT, slotField } from '../game/fields.js';
import { targetChar, takeCharSuffix, be, have } from '../game/level.js';
import { GUN_KINDS, MAX_UPGRADE, filterGuns, resolveGun, slotText, gunList } from '../game/guns.js';

const NO_COMMAND = -1; // gun factory: not spawned by a map command
const MODEL_WIDTH = 30;
const NUMBER_WIDTH = 5;
const SLOT_WIDTH = 5;

function listGuns(filter) {
  const found = filterGuns(filter);
  for (const kind of GUN_KINDS) {
    const rows = found.filter(({ g }) => g.kind === kind);
    if (!rows.length) continue;
    print(`[${kind}] ${rows.length}`, COLOR.title);
    for (const { g, n } of rows) {
      print(`  ${('#' + n).padEnd(NUMBER_WIDTH)}${g.model.padEnd(MODEL_WIDTH)}slot ${slotText(g.slot).padEnd(SLOT_WIDTH)}${g.name}`);
    }
  }
  if (!found.length) print(`No gun matches "${filter}"`, COLOR.error);
  else print(`Give one with: give <# | model | part of name> [upgrade 0-${MAX_UPGRADE}]`, COLOR.hint);
}

const isCarrySlot = (slot) => slot >= 0 && slot <= LAST_SLOT;

function giveGun(gun, upg, target) {
  const { p, i, who } = targetChar(target);
  if (!(p[F.HP] > 0) || p[F.DEAD]) throw new Error(`${be(who)} dead`);
  const g = game.spawnGun(gun.model, { x: p.x, y: p.y, upg, command: NO_COMMAND });
  if (!g) throw new Error(`the game did not create "${gun.model}"`);
  const slot = g[F.G_SLOT];
  const idx = g[F.INDEX];
  if (g[F.G_FIXED] || !isCarrySlot(slot)) {
    // Grenade items are picked up by walking over them; vehicle guns cannot be carried.
    print(`Spawned ${gun.name} at the feet of ${who}`, COLOR.ok);
    return;
  }
  // The game's slot setter drops whatever gun is in that slot, then assigns the new one.
  p[slotField(slot)] = idx;
  if (p[slotField(slot)] !== idx) {
    print(`Spawned ${gun.name} at the feet of ${who} (slot ${slot} could not be assigned)`, COLOR.notice);
    return;
  }
  p.curwea = idx;
  game.refreshChar(i);
  print(`Gave ${who} ${gun.name} [${gun.model}] in slot ${slot}, upgrade ${upg}`, COLOR.ok);
}

function give(rawArgs) {
  const usage = `usage: give <# | model | name> [upgrade 0-${MAX_UPGRADE}] [to <char#>]. Type "guns" / "chars".`;
  if (!rawArgs.length) throw new Error(usage);
  const { args, target } = takeCharSuffix(rawArgs, 'to', usage);
  let upg = MAX_UPGRADE;
  if (args.length > 1 && /^\d+$/.test(args[args.length - 1])) {
    const n = Number(args.pop());
    if (n > MAX_UPGRADE) throw new Error(`upgrade must be 0-${MAX_UPGRADE}. The slot is fixed per gun (see "guns"), e.g. the defibrillator is always slot 6.`);
    upg = n;
  }
  if (!args.length) throw new Error(usage);
  giveGun(resolveGun(args.join(' ')), upg, target);
}

// How the game tosses a dropped gun: its two points get these speeds along the aim
// angle, and it starts this far ahead of the character.
const TOSS = Object.freeze({ speedA: 7, liftA: 2, speedB: 1, sinkB: 2, ahead: 20 });

// Same steps as the game's own drop (V key), without its conditions (it refuses e.g.
// in a vehicle or when the gun cannot be thrown): empty the slot, toss the gun along
// the aim angle, wake its physics points, re-equip.
function dropGun(p, slot) {
  const idx = p[slotField(slot)];
  if (!(idx >= 0)) return null;
  const g = game.guns()[idx];
  // The slot setter clears picken_by and, for you, blocks re-pickup for 1 second.
  p[slotField(slot)] = EMPTY_SLOT;
  if (p[slotField(slot)] !== EMPTY_SLOT) throw new Error(`slot ${slot} could not be emptied`);
  if (p.curwea === idx) p.curwea = EMPTY_SLOT;
  if (g) {
    const a = g[F.G_PT_A], b = g[F.G_PT_B];
    const VX = game.ptVelX(), VY = game.ptVelY(), X = game.ptX();
    const ang = p[F.AIM] || 0, dir = p[F.FACING] || 0;
    VX[a] += Math.sin(ang) * TOSS.speedA; VY[a] += Math.cos(ang) * TOSS.speedA - TOSS.liftA;
    VX[b] += Math.sin(ang) * TOSS.speedB; VY[b] += Math.cos(ang) * TOSS.speedB + TOSS.sinkB;
    X[a] += dir * TOSS.ahead; X[b] += dir * TOSS.ahead;
    game.wakePt(a);
    game.wakePt(b);
  }
  return g;
}

function drop(rawArgs) {
  const usage = `usage: drop  |  drop <slot ${FIRST_SLOT}-${LAST_SLOT}>  |  drop all  (add "from <char#>" for a bot)`;
  const { args, target } = takeCharSuffix(rawArgs, 'from', usage);
  if (args.length > 1) throw new Error(usage);
  const { p, i, who } = targetChar(target);
  const a = (args[0] || '').toLowerCase();
  let slots;
  if (a === 'all') slots = GUN_SLOTS;
  else if (GUN_SLOTS.map(String).includes(a)) slots = [Number(a)];
  else if (!a) {
    const held = GUN_SLOTS.find((n) => p.curwea >= 0 && p[slotField(n)] === p.curwea);
    if (held === undefined) throw new Error(`${be(who)} not holding a carried gun (swords or vehicle gun)`);
    slots = [held];
  } else throw new Error(usage);
  const dropped = [];
  for (const sl of slots) {
    const g = dropGun(p, sl);
    if (g) dropped.push(`${game.gunName(g.model) || g.model || 'gun'} (slot ${sl})`);
  }
  if (!dropped.length) {
    print(a === 'all' ? `${capitalize(have(who))} no guns` : `Slot ${slots[0]} is empty`, COLOR.notice);
    return;
  }
  game.refreshChar(i);
  print(`${who === 'you' ? 'Dropped' : who + ' dropped'}: ${dropped.join(', ')}`, COLOR.ok);
}

export const gunsCommand = {
  name: 'guns',
  aliases: ['weapons'],
  usage: 'guns [filter]',
  desc: 'List every gun model, including community (custom) guns',
  help: {
    about: [
      'Every gun the game can build, read from its own gun factory, in three',
      'groups: standard, custom (community) and items. The # is what "give" takes,',
      'and the slot is fixed per gun.',
    ],
    args: [
      ['[filter]', 'part of a model or of a display name'],
    ],
    examples: [
      ['guns', 'all of them'],
      ['guns rail', 'only models or names containing "rail"'],
    ],
    see: ['give', 'drop'],
  },
  run: (args, { rest }) => listGuns(rest),
};

export const gunCommands = [
  {
    name: 'give',
    usage: `give <gun> [0-${MAX_UPGRADE}] [to #]`,
    desc: `Give a gun by #, model or name; upgrade (default ${MAX_UPGRADE}); "to #" = a bot (single-player)`,
    clientOnly: 'the gun exists only in your game; other players never see it and cannot pick it up',
    complete: (i) => (i === 0 ? gunList().map((g) => g.model) : null),
    help: {
      about: [
        'Spawns the gun at the character\'s feet and equips it when that slot is free.',
      ],
      args: [
        ['<gun>', 'a # from "guns", a model name, or part of a name'],
        [`[0-${MAX_UPGRADE}]`, `upgrade level, ${MAX_UPGRADE} by default`],
        ['to #', 'give it to a bot instead (single-player only)'],
      ],
      examples: [
        ['give 12', 'gun #12 from "guns"'],
        ['give gun_railgun 2', 'by model, upgrade 2'],
        ['give rail', 'by part of a name, when only one gun matches'],
        ['give deagle to 3', 'to bot #3'],
      ],
      notes: [
        'Grenade items are picked up by walking over them; vehicle guns cannot be carried.',
        'An ambiguous name is refused and the matches are listed.',
      ],
      see: ['guns', 'drop', 'chars'],
    },
    run: give,
  },
  {
    name: 'drop',
    aliases: ['throw'],
    usage: 'drop [slot | all] [from #]',
    desc: `Force-drop (toss) the gun in hand, in slot ${FIRST_SLOT}-${LAST_SLOT}, or all guns; "from #" = a bot (single-player)`,
    clientOnly: 'the drop is not sent to the server; other players still see the gun in your hands',
    help: {
      about: [
        'Force-drops: the game\'s own V key refuses in a vehicle, or for guns that',
        'cannot be thrown. This does not.',
      ],
      args: [
        ['(nothing)', 'the gun in your hands'],
        [`<${FIRST_SLOT}-${LAST_SLOT}>`, 'that slot'],
        ['all', 'every carried gun'],
        ['from #', 'a bot instead (single-player only)'],
      ],
      examples: [
        ['drop', 'what you are holding'],
        ['drop 2', 'slot 2'],
        ['drop all', 'everything'],
        ['drop all from 3', 'disarm bot #3'],
      ],
      see: ['give', 'guns'],
    },
    run: drop,
  },
];
