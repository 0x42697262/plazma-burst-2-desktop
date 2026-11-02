import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  net_log_state: {
    capability: CAPABILITY.netlog.state, aliases: Object.freeze(['netlog_state']), type: SETTING_TYPE.bool, group: GROUP.network, default: false,
    desc: 'Also record every unreliable state update (player state, 60 to 250 a second: large files)',
    about: ['State updates are sent every 16 ms over a socket and every 4 ms peer to peer.',
      'Off, they are only counted (STAT lines); on, each one is written too.'],
  },
});
