import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGuns, kindOf, resolveGun, slotText, type Gun } from './domain/catalog.ts';

const list: Gun[] = [
  { model: 'gun_railgun', name: 'Railgun', kind: 'standard', slot: 4 },
  { model: 'gun_rail_mini', name: 'Mini rail', kind: 'standard', slot: 4 },
  { model: 'item_grenade', name: 'Grenade', kind: 'items', slot: -2 },
  { model: 'paul_cannon', name: 'Paul\'s cannon', kind: 'custom', slot: 7 },
];

test('a gun is found by number, exact model or name, or the one gun a part matches', () => {
  assert.equal(resolveGun(list, '2', 2).model, 'gun_rail_mini');
  assert.equal(resolveGun(list, 'gun_railgun', null).model, 'gun_railgun');
  assert.equal(resolveGun(list, 'railgun', null).model, 'gun_railgun');
  assert.equal(resolveGun(list, 'cannon', null).model, 'paul_cannon');
  assert.throws(() => resolveGun(list, '9', 9), /no gun #9/);
  assert.throws(() => resolveGun(list, 'rail', null), /"rail" matches 2 guns: gun_railgun, gun_rail_mini/);
  assert.throws(() => resolveGun(list, 'laser', null), /no gun matches "laser"/);
});

test('kinds, slots and the filter', () => {
  assert.deepEqual([kindOf('gun_x'), kindOf('item_x'), kindOf('paul')], ['standard', 'items', 'custom']);
  assert.deepEqual([slotText(4), slotText(-2), slotText(null)], ['4', 'item', '?']);
  assert.deepEqual(filterGuns(list, 'RAIL').map(({ number }) => number), [1, 2]);
  assert.equal(filterGuns(list, undefined).length, 4);
});
