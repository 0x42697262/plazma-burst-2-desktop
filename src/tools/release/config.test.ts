import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builderConfig, fileNameOf, stagedPackage } from './config.ts';

const player = { name: 'player', title: 'Plazma Burst 2 Client', appId: 'io.github.plazma-burst-2-desktop.player', features: ['server_list'], capabilities: [] } as const;

test('an edition packages under its own id and title, with only the built bundles and no source maps', () => {
  const config = builderConfig({ edition: player, electronVersion: '45.0.0', outDir: '/out', platforms: ['linux', 'windows'] });
  assert.equal(config.appId, 'io.github.plazma-burst-2-desktop.player');
  assert.equal(config.productName, 'Plazma Burst 2 Client');
  assert.equal(config.artifactName, 'Plazma-Burst-2-Client-${version}-${os}-${arch}.${ext}');
  assert.deepEqual(config.files, ['dist/**/*', '!dist/**/*.map', 'package.json']);
  assert.deepEqual(config.linux?.target, ['AppImage']);
  assert.deepEqual(config.win?.target, ['nsis', 'portable']);
  assert.equal(config.publish, null, 'publishing is never part of a build');
});

test('only the asked platforms are configured', () => {
  const config = builderConfig({ edition: player, electronVersion: '45.0.0', outDir: '/out', platforms: ['linux'] });
  assert.equal('win' in config, false);
});

test('the staged package.json names the edition and starts the bundled main process', () => {
  assert.deepEqual(stagedPackage(player, { version: '1.2.0', description: 'desc', author: 'someone' }), {
    name: 'io.github.plazma-burst-2-desktop.player', productName: 'Plazma Burst 2 Client', version: '1.2.0', description: 'desc', author: 'someone', desktopName: 'io.github.plazma-burst-2-desktop.player.desktop', main: 'dist/wrapper/main.cjs', private: true,
  });
  assert.equal(fileNameOf('Sad: Burst / 2'), 'Sad-Burst-2');
});
