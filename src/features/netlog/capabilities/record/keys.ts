import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  net_log: {
    capability: CAPABILITY.netlog.record, aliases: Object.freeze(['net_logs', 'packet_log']), type: SETTING_TYPE.bool, group: GROUP.network, default: true,
    desc: 'Record the game\'s network messages and packet losses to data/netlogs/, one readable file per run ' +
      '("netlog" shows it)',
    about: ['Every message the game sends and receives on its connections, packet losses',
      '(slow and missing acks, dropped packets, gaps, late messages) and once a second',
      'the ping and traffic of each connection, as plain text in data/netlogs/: one file per',
      'run and game window. "netlog" shows it here, "netlog runs" lists other instances.'],
  },
});
