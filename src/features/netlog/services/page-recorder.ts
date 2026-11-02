import { settings } from '#console/kernel/state/store.ts';
import { gameNetwork } from '#console/kernel/game/network.ts';
import { SETTING } from '../keys.ts';
import { createRecorder } from './recorder.ts';
import { methodWrapper } from '../adapters/method-wrap.ts';
import { onPageHide } from '../adapters/page.ts';
import { wrapperLineSink } from '../adapters/wrapper-client.ts';

type SettingsStore = { effective(key: string): unknown };

const store = settings as unknown as SettingsStore;
export const isSet = (key: string): boolean => store.effective(key) === true;
export const effectiveSetting = (key: string): unknown => store.effective(key);

export const recorder = createRecorder({
  network: gameNetwork,
  settings: { recording: () => isSet(SETTING.netLog), everything: () => isSet(SETTING.netLogAll), states: () => isSet(SETTING.netLogState) },
  sink: wrapperLineSink,
  methods: methodWrapper,
  onPageHide,
  warn: (...parts) => console.warn(...parts),
  now: () => Date.now(),
});
