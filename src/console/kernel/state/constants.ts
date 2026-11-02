import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../core/constants.ts';
import type { FeatureId } from '#shared/features/keys.ts';
import { GROUP, SETTING_TYPE, type Group, type SettingType } from './keys.ts';

export type SettingSpec = Readonly<{
  feature: FeatureId;
  capability?: string;
  type: SettingType;
  group: Group;
  min?: number;
  max?: number;
  default?: boolean | number | string;
  desc: string;
  about?: readonly string[];
  example?: string;
  phrases?: readonly RegExp[];
  extraValues?: readonly string[];
}>;

export const SAVE_DELAY_MS = 150;
export const HISTORY_MAX = 200;

export const CORE_SETTINGS = Object.freeze({
  page_size: {
    type: SETTING_TYPE.int, group: GROUP.console, min: 10, max: PAGE_SIZE_MAX, default: PAGE_SIZE_DEFAULT,
    desc: 'Lines per page for long lists; "more" = next page',
    about: [`Lines per page for long lists. The default (${PAGE_SIZE_DEFAULT}) keeps a whole page`,
      'inside this log.'],
    example: '50',
  },
});
