import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE, devRoute } from './routes.ts';
import { ROUTE_NAME } from './keys.ts';

test('every route the console calls is the dev folder plus its name', () => {
  assert.equal(devRoute('kv'), '__dev/kv');
  assert.equal(ROUTE.console, '__dev/console/');
  assert.deepEqual(Object.keys(ROUTE), Object.keys(ROUTE_NAME));
});
