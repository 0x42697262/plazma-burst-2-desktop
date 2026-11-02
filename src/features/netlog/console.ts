import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { NETLOG_PARTS } from './capabilities.ts';
import { SETTING } from '#features/netlog/keys.ts';
import { CORE_SETTING } from '#console/kernel/state/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import { runKey } from '#console/kernel/commands/settings.ts';
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

const store = settings as unknown as SettingsStore;
const isSet = (key: string): boolean => store.effective(key) === true;
const KEY_OF_SETTING: Readonly<Record<SettingName, string>> = Object.freeze({ [SETTING_NAME.recording]: SETTING.netLog, [SETTING_NAME.everything]: SETTING.netLogAll });

export const recorder = createRecorder({
  network: gameNetwork,
  settings: { recording: () => isSet(SETTING.netLog), everything: () => isSet(SETTING.netLogAll), states: () => isSet(SETTING.netLogState) },
  sink: wrapperLineSink,
  methods: methodWrapper,
  onPageHide,
  warn: (...parts) => console.warn(...parts),
  now: () => Date.now(),
});

const netlogCommand = createNetlogCommand({
  recorder,
  remote: REMOTE,
  pageSize: () => store.effective(CORE_SETTING.pageSize) as number,
  everythingOn: () => isSet(SETTING.netLogAll),
  statesOn: () => isSet(SETTING.netLogState),
  setKey: (setting, words) => { runKey(KEY_OF_SETTING[setting], words); },
});

export const netlogConsole = consoleFeatureOf(FEATURE.netlog, NETLOG_PARTS, {
  commands: [netlogCommand],
  ticks: [{ name: TICK_NAME, everyMs: NET_TICK_MS, errorsShown: TICK_ERRORS_SHOWN, run: () => recorder.tick() }],
});
