import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { attachLog } from '#console/kernel/ui/log.ts';
import { KEY_WIDTH, USAGE_WIDTH, VALUE_WIDTH } from './constants.ts';

type LoggedLine = { style: Record<string, string>; childNodes: Array<{ text?: string }> };

const textOf = (line: LoggedLine): string => line.childNodes.map((segment) => segment.text ?? '').join('');
const sorted = (names: readonly string[]): string[] => [...names].sort((left, right) => left.localeCompare(right));

function capture(): LoggedLine[] {
  const lines: LoggedLine[] = [];
  attachLog({ append: (node: Node) => { lines.push(node as unknown as LoggedLine); }, childNodes: { length: 0 }, firstChild: null, scrollTop: 0, scrollHeight: 0, textContent: '' });
  return lines;
}

test('help lists the commands alphabetically; a long description wraps under its column; a long usage puts it on the next line', async () => {
  const game = await bootConsole();
  game.run('page_size 2000');
  const lines = capture();
  game.run('help');
  const texts = lines.map(textOf);
  const first = texts.findIndex((text) => text === 'Commands:');
  const last = texts.findIndex((text, index) => index > first && !text.startsWith('  '));
  const rows = lines.slice(first + 1, last);
  const names = rows.map(textOf).filter((text) => /^ {2}\S/.test(text)).map((text) => text.trim().split(/\s+/).slice(0, 2).join(' '));
  const commandNames = names.map((name) => name.split(' ')[0] ?? '');
  assert.deepEqual(commandNames, sorted(commandNames), 'commands in alphabetical order');
  const column = 2 + USAGE_WIDTH + 1;
  const longDescription = rows.find((line) => textOf(line).startsWith('  fly_') || textOf(line).includes('Free camera:'));
  assert.equal(longDescription?.style.paddingLeft, `${column}ch`, 'wrapped text hangs at the description column');
  assert.equal(longDescription?.style.textIndent, `-${column}ch`);
  const longUsageIndex = rows.findIndex((line) => textOf(line).trim().startsWith('zoom [percent'));
  assert.equal(textOf(rows[longUsageIndex]!).trim(), 'zoom [percent | default] [--lock] | zoom --unlock', 'a usage wider than its column is on its own line');
  const next = rows[longUsageIndex + 1];
  assert.ok(next && textOf(next).startsWith(' '.repeat(column) + 'Camera zoom'), 'and the description on the next line, in the column');
  game.run('unset page_size');
});

test('list shows the groups and the keys alphabetically; a long description wraps under its column', async () => {
  const game = await bootConsole();
  game.run('page_size 2000');
  const lines = capture();
  game.run('list');
  const texts = lines.map(textOf);
  const groups = texts.filter((text) => /^\[\w+\]$/.test(text)).map((text) => text.slice(1, -1));
  assert.deepEqual(groups, sorted(groups), 'groups in alphabetical order');
  const playerStart = texts.indexOf('[player]');
  const playerEnd = texts.findIndex((text, index) => index > playerStart && text.startsWith('['));
  const keys = texts.slice(playerStart + 1, playerEnd).filter((text) => /^ {2}\S/.test(text)).map((text) => text.trim().split(/\s+/)[0] ?? '');
  assert.deepEqual(keys, sorted(keys), 'keys in alphabetical order');
  const column = 2 + KEY_WIDTH + 1 + VALUE_WIDTH + 1;
  const flyRow = lines.find((line) => textOf(line).startsWith('  fly ') );
  assert.equal(flyRow?.style.paddingLeft, `${column}ch`);
  const longKeyIndex = lines.findIndex((line) => textOf(line).startsWith('  fly_sweep_throttle'));
  const after = lines[longKeyIndex + 1];
  assert.ok(after && textOf(after).startsWith(' '.repeat(column) + 'How fast the sweep flies'), 'a key wider than its column: the description on the next line');
  game.run('unset page_size');
});
