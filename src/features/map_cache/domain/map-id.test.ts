import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEditedName, isLocalMapId, localMapId, localNameOf, mapFileName } from './map-id.ts';

test('map IDs become safe file names; local IDs and edited names are recognized', () => {
  assert.equal(mapFileName('a/b:c'), 'a%2fb%3ac.xml', 'the shared naming in #kernel/maps/file-name.ts');
  assert.equal(isLocalMapId('LOCAL-arena'), true);
  assert.equal(isLocalMapId('arena'), false);
  assert.equal(localNameOf('local-arena'), 'arena');
  assert.equal(localMapId('arena'), 'local-arena');
  assert.equal(isEditedName('My map_1.v2'), true);
  assert.equal(isEditedName('.hidden'), false);
  assert.equal(isEditedName('../x'), false);
  assert.equal(isEditedName(null), false);
});
