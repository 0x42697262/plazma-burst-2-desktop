import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  net_log_all: {
    capability: CAPABILITY.netlog.all, aliases: Object.freeze(['netlog_all', 'net_log_everything']), type: SETTING_TYPE.bool, group: GROUP.network, default: false,
    desc: 'Log everything: every packet (PKT: size, ack, what it carries) and every state update, decoded (very large files)',
    about: ['Adds a PKT line for every packet sent and received, also the ones that only',
      'carry an acknowledgement, and turns on net_log_state: every unreliable state',
      'update with its parts decoded, and writes every message whole (without it a part',
      'over 2000 characters, a map or a match list, is cut). 60 to 250 packets a second',
      'each way: large files.'],
  },
});
