// tools/fetch-opcodes.js: reading the map editor's action list (lib_params.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { parseParams, check } = createRequire(import.meta.url)('../tools/fetch-opcodes.js');

const SRC = `
function addTrigger(trigger_type_id, description, paramA, paramB ) { /* the editor's own */ }
addTrigger(-1, 'Do nothing', 'nochange', 'nochange');
addTrigger(0, "Movable &#8250; Force Movable 'A' move to region 'B'", 'door', 'region'); AddOpcodeAlias('MovableTo');
//addTrigger(6, "Region &#8250; old", 'region', 'value');
addTrigger(6, "Region &#8250; Make damage in Region 'B' with <b>power</b> of 'A' hit points", 'value', 'region'); AddOpcodeAlias('DamageRegion');
/* addTrigger(7, "commented", 'x', 'y'); AddOpcodeAlias('Gone'); */
addTrigger(8, "Url &#8250; see http://example.com/a // not a comment", "string", "nochange");
addTrigger(9, "Twice", "string", "string"); AddOpcodeAlias('Same');
addTrigger(10, "Twice again", "string", "string"); AddOpcodeAlias('Same');
//addTrigger(11, "x", 'a', 'b'); AddOpcodeAlias('CommentedAlias');
addTrigger(12, "No alias, after a commented one", "string", "string");
`;

test('fetch-opcodes reads actions and aliases like the editor registers them', () => {
  const { actions, aliases } = parseParams(SRC);
  assert.deepEqual(Object.keys(actions).map(Number).sort((a, b) => a - b), [-1, 0, 6, 8, 9, 10, 12]);
  assert.deepEqual(actions[6], { desc: "Region › Make damage in Region 'B' with power of 'A' hit points", a: 'value', b: 'region', alias: 'DamageRegion' });
  assert.equal(actions[8].desc, 'Url › see http://example.com/a // not a comment');
  assert.equal(actions[12].alias, undefined, 'an alias in a comment belongs to nothing');
  assert.deepEqual(aliases, { MovableTo: 0, DamageRegion: 6, Same: 9 }, 'a name used twice is the lower number');
  assert.match(check({ actions, aliases }).join('\n'), /only 7 actions found/);
});
