import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBaseName, mapFileName, mapIdOfFile } from './file-name.ts';

test('a map ID is one file name in data/maps, for the game client and the private server alike, and back', () => {
  assert.equal(mapFileName('author-name 2'), 'author-name 2.xml');
  assert.equal(mapFileName('a/b:c'), 'a%2fb%3ac.xml', 'what could leave the folder is escaped');
  assert.equal(mapBaseName('a/b:c'), 'a%2fb%3ac');
  assert.equal(mapIdOfFile('a%2fb%3ac.xml'), 'a/b:c');
  assert.equal(mapIdOfFile('arena.TXT'), 'arena');
});
