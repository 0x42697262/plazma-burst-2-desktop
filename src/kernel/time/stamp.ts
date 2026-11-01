import { MONTH_OFFSET, STAMP_FIELD_WIDTH, STAMP_PAD } from './constants.ts';
import { TEXT } from './text.ts';

const pad = (value: number): string => String(value).padStart(STAMP_FIELD_WIDTH, STAMP_PAD);

export const stampOf = (moment: Date): string => TEXT.stamp(
  moment.getFullYear(), pad(moment.getMonth() + MONTH_OFFSET), pad(moment.getDate()), pad(moment.getHours()), pad(moment.getMinutes()), pad(moment.getSeconds()),
);
