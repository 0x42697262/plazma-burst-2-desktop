import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT } from '#shared/features/keys.ts';
import { relaunchOptions } from './relaunch-options.ts';

const APP_IMAGE = '/home/player/Plazma-Burst-2-Client.AppImage';
const MOUNTED_BINARY = '/tmp/.mount_Plazma/plazma-burst-2';

test('an AppImage starts again from the AppImage file, not from its mount that closes on exit', () => {
  const options = relaunchOptions([MOUNTED_BINARY], { APPIMAGE: APP_IMAGE }, CLIENT.sadburst);
  assert.deepEqual(options, { args: ['--sadburst'], execPath: APP_IMAGE });
});

test('elsewhere the running executable starts again', () => {
  const options = relaunchOptions(['electron', '.', '--sadburst'], {}, CLIENT.official);
  assert.deepEqual(options, { args: ['.'] });
});

test('switching from one Sad Burst client to the other swaps the flag', () => {
  assert.deepEqual(relaunchOptions(['electron', '.', '--sadburst'], {}, CLIENT.sadburstErich5), { args: ['.', '--sadburst-erich5'] });
  assert.deepEqual(relaunchOptions([MOUNTED_BINARY, '--sadburst-erich5'], { APPIMAGE: APP_IMAGE }, CLIENT.sadburst), { args: ['--sadburst'], execPath: APP_IMAGE });
});
