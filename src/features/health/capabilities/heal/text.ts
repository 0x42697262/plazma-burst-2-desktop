import { CLIENT_ONLY_REASON } from '#console/kernel/state/schema.ts';

export const CLIENT_ONLY = CLIENT_ONLY_REASON as string;

export const TEXT = Object.freeze({
  down: 'you are down; use "revive"',
  healed: (hp: unknown) => `HP = ${String(hp)}`,
  heal: { usage: 'heal', desc: 'Refill HP', about: ['Refills your HP to your current max. Needs a level, and refuses while you', 'are down, because the body has to be stood up first ("revive").'], see: ['revive', 'hp', 'max_hp'] },
});
