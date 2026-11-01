import { CLIENT_ONLY_REASON } from '#console/kernel/state/schema.ts';

export const CLIENT_ONLY = CLIENT_ONLY_REASON as string;

export const TEXT = Object.freeze({
  dead: 'you are dead',
  teleported: (label: string | undefined, targetX: number, targetY: number) => `Teleported to ${label ? `${label} at ` : ''}${targetX}, ${targetY}`,
  crosshairUnknown: 'crosshair position unknown',
  thatIsYou: 'that is you',
  positionUnknown: (index: number) => `could not read the position of #${index}`,
  tpOnUsage: 'usage: bind <key> tp   e.g. bind f tp',
  tpOffUsage: 'usage: tp --off   (unbinds every key bound to "tp")',
  noTpKey: 'No key is bound to "tp"',
  needsBinds: 'A key for "tp" needs key binds (the "binds" feature), which are not in this app.',
  oldHotkey: (message: string, option: string, rest: string) => `${message} For the old hotkey syntax, type "tp --${option}${rest ? ` ${rest}` : ''}".`,
  tp: {
    usage: 'tp [x y | # | name]',
    desc: 'Teleport to the crosshair, to x y (see "pos"), or to a character (see "chars")',
    about: ['With no argument: to your crosshair.'],
    args: [
      ['x y', 'exact coordinates (see "pos")'],
      ['<# | name>', 'to a character, by index or part of a nickname'],
      ['to <name>', 'the same, when the name could be read as something else'],
      ['-- <name>', 'everything after "--" is the name: "tp -- 1 2" is a player named "1 2"'],
      ['--on <key>', 'the old hotkey syntax: the same as "bind <key> tp"'],
      ['--off', 'unbind every key bound to "tp"'],
    ],
    examples: [['tp', 'to the crosshair'], ['tp 1200 -400', 'to those coordinates'], ['tp 3', 'to character #3'], ['tp to bob', 'to the first nickname containing "bob"'], ['bind f tp', 'teleport to the crosshair with F']],
    notes: ['Words that are not options are a character, so "tp off" goes to a player named "off".'],
    see: ['pos', 'chars', 'bind'],
  },
});
