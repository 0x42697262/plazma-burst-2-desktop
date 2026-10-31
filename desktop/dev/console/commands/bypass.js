// "bypass": the console's ranked match protection (overrides/server-checks.js) and the one
// way to turn it off. "bypass checks" warns in red, then the next line typed into the
// console must be exactly UNLOCK_PHRASE (state/danger.js); dispatch.js takes that line.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { UNLOCK_PHRASE, checksBypassed, askToBypass, protectAgain } from '../state/danger.js';
import { REASON, rankedMatch } from '../overrides/server-checks.js';

const WARNING = Object.freeze([
  'WARNING: DANGEROUS. This turns off the console\'s protection in ranked matches.',
  'It lets these through again in approved, ranked matches:',
  '  max_hp above your normal max HP, hp_bonus, hp_bonus_pct, "hp +<n>", "game god", "game grow":',
  `    ${REASON.hp}.`,
  '  zooming out ("zoom" below 100%, "game zoom 25" / "game zoom 50"):',
  `    ${REASON.aim}.`,
  'These are server-side checks: the match\'s server sees them, not just your game.',
  'What the official server does with a report is not known. A kick, or a ban of',
  'the account you play with, is possible. Other players see the aim message.',
  `To go ahead, type exactly: ${UNLOCK_PHRASE}`,
  'Anything else turns this down. It lasts until the page reloads or "bypass off".',
]);

export const BYPASSED_LINES = Object.freeze([
  'Protection OFF: the console no longer holds anything back in ranked matches.',
  'The server\'s checks still run. "bypass off" turns the protection back on.',
]);
export const NOT_BYPASSED_LINE = 'Not turned off: that was not the phrase. The protection stays on, and the line was not run.';

function status(args) {
  if (args.length) throw new Error('usage: bypass [checks | off]');
  if (checksBypassed()) {
    print('Protection: OFF ("bypass checks" was confirmed). Nothing is held back in ranked matches.', COLOR.error);
    print('"bypass off" turns it back on. A page reload does too.', COLOR.hint);
    return;
  }
  print(`Protection: on. In approved, ranked matches${rankedMatch() ? ' (you are in one now)' : ''} the console holds back what the match\'s server checks:`, COLOR.ok);
  print('  Unranked matches, unapproved maps and single-player are not touched.', COLOR.hint);
  print('  raising your HP (max_hp, hp_bonus, hp_bonus_pct, game god, game grow) and zooming out.', COLOR.hint);
  print('Server-side checks: ANTICHEAT.md section 14. "bypass checks" turns the protection off (dangerous).', COLOR.hint);
}

function askToTurnOff(args, ctx) {
  if (args.length) throw new Error('usage: bypass checks');
  if (ctx.source || ctx.chained) throw new Error('type "bypass checks" yourself, on a line of its own (not from a bind, a profile or a ";" chain)');
  if (checksBypassed()) { print('The protection is already off. "bypass off" turns it back on.', COLOR.notice); return; }
  for (const line of WARNING) print(line, COLOR.error);
  askToBypass();
}

function turnOn(args) {
  if (args.length) throw new Error('usage: bypass off');
  const was = checksBypassed();
  protectAgain();
  print(was ? 'Protection on again: ranked matches hold back what the server checks.' : 'The protection is already on.', was ? COLOR.ok : COLOR.notice);
}

export const bypassCommand = {
  // Remote play: a tester plays on the host's account, so they cannot take this risk for
  // the host (core/remote.js).
  remote: false,
  name: 'bypass',
  usage: 'bypass [checks | off]',
  desc: 'The console\'s protection in approved, ranked matches. "bypass checks" turns it off (dangerous, asks first)',
  help: {
    about: [
      'In an approved, ranked match the console holds back what the match\'s server checks',
      '(server-side checks, ANTICHEAT.md section 14): raising your HP above your normal',
      'max, and zooming out. Typing them is refused, and a setting you already had is not',
      'applied there (it is kept for other matches and single-player). Unranked matches',
      'and unapproved maps are not touched.',
      '"bypass checks" turns that off after a red warning: the next line you type must',
      `be exactly ${UNLOCK_PHRASE} (capitals as shown). Anything else turns it down.`,
    ],
    examples: [
      ['bypass', 'whether the protection is on'],
      ['bypass checks', 'turn it off: warns, then asks for the phrase'],
      ['bypass off', 'turn it back on'],
    ],
    notes: [
      'Only for this page load: a reload turns the protection back on. Not in remote play.',
    ],
    see: ['max_hp', 'zoom'],
  },
  run: status,
  subcommands: [
    {
      name: 'checks',
      aliases: ['check'],
      usage: 'bypass checks',
      desc: 'Turn the ranked match protection off: a red warning, then type the phrase',
      help: {
        about: [
          'Prints what it lets through and what can happen, then waits for the next line',
          `typed into the console. Exactly ${UNLOCK_PHRASE} turns the protection off;`,
          'any other line turns it down and is not run. Keys and binds still work while it waits.',
        ],
        notes: ['Type it yourself: from a bind, a profile or a ";" chain it is refused.'],
        see: ['bypass'],
      },
      run: askToTurnOff,
    },
    {
      name: 'off',
      aliases: ['protect'],
      usage: 'bypass off',
      desc: 'Turn the protection back on (stop bypassing)',
      help: { about: ['Ends "bypass checks": ranked matches hold back what the server checks again.'], see: ['bypass'] },
      run: turnOn,
    },
  ],
};
