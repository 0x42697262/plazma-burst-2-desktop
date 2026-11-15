import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { AIM_RADIUS_DEFAULT, AIM_RADIUS_MAX, AIM_RADIUS_MIN } from '../../constants.ts';
import { SETTING } from '../../keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  [SETTING.radius]: {
    capability: CAPABILITY.wire.send, aliases: Object.freeze(['wireradius', 'aim_radius']),
    type: SETTING_TYPE.number, group: GROUP.network, min: AIM_RADIUS_MIN, max: AIM_RADIUS_MAX, default: AIM_RADIUS_DEFAULT,
    desc: 'Pixels from the crosshair that "aim" and "area" targets reach',
    about: ['How far "aim" (nearest to the crosshair) and "area" (everyone around the',
      'crosshair) look when a wire field picks a target without an explicit radius.'],
    example: '300',
  },
});
