import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { KEY } from '../../../desktop/dev/console/state/schema.js';
import { settings } from '../../../desktop/dev/console/state/store.js';
import { REMOTE } from '#console/kernel/core/mode.ts';
import { runKey } from '../../../desktop/dev/console/commands/settings.js';
import { NET_TICK_MS, TICK_ERRORS_SHOWN } from './constants.ts';
import { SETTING_NAME, type SettingName } from './keys.ts';
import { TICK_NAME } from './text.ts';
import { createRecorder } from './services/recorder.ts';
import { createNetlogCommand } from './entry/command.ts';
import { gameNetwork } from '#console/kernel/game/network.ts';
import { methodWrapper } from './adapters/method-wrap.ts';
import { onPageHide } from './adapters/page.ts';
import { wrapperLineSink } from './adapters/wrapper-client.ts';

type SettingsStore = { effective(key: string): unknown };
type SettingKeys = { NET_LOG: string; NET_LOG_STATE: string; NET_LOG_ALL: string; PAGE_SIZE: string };

const store = settings as unknown as SettingsStore;
const keys = KEY as unknown as SettingKeys;
const isSet = (key: string): boolean => store.effective(key) === true;
const KEY_OF_SETTING: Readonly<Record<SettingName, string>> = Object.freeze({ [SETTING_NAME.recording]: keys.NET_LOG, [SETTING_NAME.everything]: keys.NET_LOG_ALL });

export const recorder = createRecorder({
  network: gameNetwork,
  settings: { recording: () => isSet(keys.NET_LOG), everything: () => isSet(keys.NET_LOG_ALL), states: () => isSet(keys.NET_LOG_STATE) },
  sink: wrapperLineSink,
  methods: methodWrapper,
  onPageHide,
  warn: (...parts) => console.warn(...parts),
  now: () => Date.now(),
});

const netlogCommand = createNetlogCommand({
  recorder,
  remote: REMOTE,
  pageSize: () => store.effective(keys.PAGE_SIZE) as number,
  everythingOn: () => isSet(keys.NET_LOG_ALL),
  statesOn: () => isSet(keys.NET_LOG_STATE),
  setKey: (setting, words) => { (runKey as (key: string, args: readonly string[]) => void)(KEY_OF_SETTING[setting], words); },
});

export const netlogConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.netlog,
  commands: [netlogCommand],
  ticks: [{ name: TICK_NAME, everyMs: NET_TICK_MS, errorsShown: TICK_ERRORS_SHOWN, run: () => recorder.tick() }],
});
