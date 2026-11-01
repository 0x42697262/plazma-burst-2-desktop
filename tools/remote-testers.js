#!/usr/bin/env node
// Remote play testers (docs/operations/remote-play.md): who may open a game on this machine.
//   npm run testers -- add <name>      new tester, or a new link for an existing one
//   npm run testers -- remove <name>   their link stops working (a running game ends when they leave)
//   npm run testers -- list
// Stored in desktop/remote-testers.json (not in git). The host reads it on every
// connect, so no restart is needed.
'use strict';

const path = require('path');
const { addTester, removeTester, listTesters } = require('../desktop/remote/testers');

const FILE = path.join(__dirname, '..', 'desktop', 'remote-testers.json');
const USAGE = 'usage: npm run testers -- add <name> | remove <name> | list';

function main([cmd, name]) {
  if (cmd === 'add' && name) {
    const t = addTester(FILE, name);
    console.log(`Tester "${t.name}" added. Their personal link (send it privately):`);
    console.log(`  <your address>/#t=${t.token}`);
    console.log('e.g. http://localhost:8787/#t=... on this machine, or your tunnel\'s https://... address.');
    console.log('Anyone with the link can play as them; "remove" makes it stop working.');
    return 0;
  }
  if (cmd === 'remove' && name) {
    console.log(removeTester(FILE, name) ? `Tester "${name}" removed; their link no longer works.` : `No tester "${name}".`);
    return 0;
  }
  if (cmd === 'list') {
    const list = listTesters(FILE);
    if (!list.length) console.log('No testers. Add one: npm run testers -- add <name>');
    for (const t of list) console.log(`  ${t.name.padEnd(20)} added ${t.added}`);
    return 0;
  }
  console.error(USAGE);
  return 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exitCode = 1;
}
