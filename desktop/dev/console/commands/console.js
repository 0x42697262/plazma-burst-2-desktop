// The console's own commands: paging, clearing, closing, and the ";" chain topic.
import { clearLog } from '../../../../src/console/kernel/ui/log.ts';
import { turnPage } from '../../../../src/console/kernel/ui/pager.ts';
import { closePanel } from '../ui/panel.js';

export const moreCommand = {
  name: 'more',
  aliases: ['next', 'page', 'pg'],
  usage: 'more | page <n>',
  desc: 'Next page of the last long list, or jump to page n',
  help: {
    about: [
      '"more" is the next page of the last long list, "page <n>" jumps to one, and',
      '"page 1" goes back to the top. Long lists also take "page n" directly, e.g.',
      '"triggers find god page 2".',
    ],
    see: ['page_size', 'triggers'],
  },
  run: (args) => turnPage(args[0]),
};

export const chainTopic = {
  name: 'chain',
  usage: '<command> ; <command> ...',
  desc: 'Run commands one after another in a single go, so nothing from the game can land between them',
  topicOnly: true,
  help: {
    also: [
      ';',
    ],
    about: [
      'Commands separated by ";" run in order, and the whole line runs in one go:',
      'nothing from the game or the network can happen between them.',
      'That matters when something else writes what you just set. A chat message runs',
      'the map\'s "player says" trigger, which overwrites SkinChatVar, so a "vars set"',
      'and the "vars sync" meant to send it have to be on one line or the sync can send',
      'whatever was chatted in between.',
      'A ";" inside double quotes is part of the value. "js" lines are never split,',
      'because JavaScript uses ";" itself.',
      'If one command fails the rest do not run, and the console says how many it skipped.',
    ],
    examples: [
      ['vars set SkinChatVar "-kick 3" ; vars sync SkinChatVar r', 'set and send with no gap'],
      ['set speed 2 ; get speed', 'any commands, left to right'],
      ['vars set x "a;b"', 'a quoted ";" is just text'],
      ['bind f "heal ; revive"', 'a bind holds a chain when you quote it'],
    ],
    see: ['vars sync', 'bind'],
  },
};

export const consoleCommands = [
  {
    name: 'clear',
    aliases: ['cls'],
    usage: 'clear',
    desc: 'Clear this log',
    help: {
      about: [
        'Empties this log. Overrides and binds are untouched.',
      ],
    },
    run: clearLog,
  },
  {
    name: 'close',
    aliases: ['exit'],
    usage: 'close',
    desc: 'Close the console (or press Shift+` / Esc)',
    help: {
      about: [
        'Closes the console. Shift+` and Esc do the same.',
      ],
    },
    run: closePanel,
  },
];
