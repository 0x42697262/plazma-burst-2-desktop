export type LegacyMove = Readonly<{ from: string; to: string }>;
export type LegacyPrefixMove = Readonly<{ fromDir: string; prefix: string; toDir: string }>;

export const LEGACY_MOVES: readonly LegacyMove[] = Object.freeze([
  { from: 'desktop/dev/names.js', to: 'data/names.js' },
  { from: 'desktop/dev/names.sadburst.js', to: 'data/names.sadburst.js' },
  { from: 'desktop/dev/opcodes.js', to: 'data/opcodes.js' },
  { from: 'desktop/dev/opcodes.sadburst.js', to: 'data/opcodes.sadburst.js' },
  { from: 'desktop/maps', to: 'data/maps' },
  { from: 'desktop/maps.sadburst', to: 'data/maps.sadburst' },
  { from: 'desktop/servers.json', to: 'data/servers.json' },
  { from: 'desktop/servers.json.tmp', to: 'data/servers.json.tmp' },
  { from: 'desktop/join.json', to: 'data/join.json' },
  { from: 'desktop/remote-testers.json', to: 'data/remote-testers.json' },
  { from: 'desktop/remote-data', to: 'data/remote-data' },
  { from: 'desktop/p2p-host.json', to: 'data/p2p-host.json' },
  { from: 'desktop/server.json', to: 'data/server.json' },
  { from: 'desktop/p2p-host-overrides.json', to: 'data/p2p-host-overrides.json' },
  { from: 'netlogs', to: 'data/netlogs' },
  { from: 'fingerprint', to: 'data/fingerprint' },
  { from: 'fingerprint.sadburst', to: 'data/fingerprint.sadburst' },
  { from: 'screenshots', to: 'data/screenshots' },
  { from: 'features.json', to: 'data/features.json' },
  { from: 'server/server.json', to: 'data/server/server.json' },
]);

export const LEGACY_PREFIX_MOVES: readonly LegacyPrefixMove[] = Object.freeze([
  { fromDir: 'desktop', prefix: 'credentials.json', toDir: 'data' },
  { fromDir: 'desktop', prefix: 'dev-overrides', toDir: 'data' },
  { fromDir: 'server/data', prefix: '', toDir: 'data/server' },
]);

export const LEGACY_FOLDERS_REMOVED_WHEN_EMPTY: readonly string[] = Object.freeze(['desktop/dev', 'desktop', 'server/data', 'server']);
