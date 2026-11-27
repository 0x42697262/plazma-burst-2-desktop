import { DEVICE_ID } from '../constants.ts';

export function newDeviceId(random: () => number = Math.random): string {
  return Array.from({ length: DEVICE_ID.parts }, () => Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(DEVICE_ID.radix)).join(DEVICE_ID.separator);
}
