import './kernel/commands/register-all.ts';
import { CLIENT_DETAILS } from '#shared/clients/keys.ts';
import { CLIENT } from '#shared/features/keys.ts';
import { print, TAG } from './kernel/ui/log.ts';
import { buildPanel, updateStatus, updateStatusIfOpen, openPanel, closePanel, onKeyDownCapture, onKeyUpCapture } from './kernel/ui/panel.ts';
import { COLOR } from './kernel/core/keys.ts';
import { errorBudget } from './kernel/core/guard.ts';
import { plural } from './kernel/core/words.ts';
import { SERVER } from './kernel/core/mode.ts';
import { game } from './kernel/game/bindings.ts';
import { namesMissing, CLIENT_TITLE, FIND_NAMES, SADBURST } from './kernel/game/names.ts';
import { currentMapId } from './kernel/game/level.ts';
import { load, reload as reloadStore, settings, binds, profiles, loadProblems, setMapSource } from './kernel/state/store.ts';
import { LOAD_SOURCE, type LoadSource } from './kernel/state/keys.ts';
import { applyOverrides, onActiveChange } from './kernel/overrides/frame.ts';
import { registerListSection } from './kernel/list-sections.ts';
import { run } from './kernel/dispatch.ts';
import { enabledConsoleFeatures, featureFrameHooks, featureTicks, featureListSections } from './features.ts';
import { BOOT_POLL_MS, FRAME_ERRORS_SHOWN, STATUS_EVERY_MS } from './constants.ts';
import { DESKTOP_FOLDER, FRAME_GUARD_LABEL, KEY_DOWN_EVENT, KEY_UP_EVENT, LOCAL_STORAGE_NAME, PAGE_API_GLOBAL } from './keys.ts';
import { TEXT } from './text.ts';

const SETTINGS_FILE = CLIENT_DETAILS[SADBURST ? CLIENT.sadburst : CLIENT.official].settingsFileName;

const reportError = (message: string): void => { print(message, COLOR.error); };

function printProblems(): void {
  for (const problem of loadProblems()) print(TEXT.fileProblem(SETTINGS_FILE, problem), COLOR.warn);
}

const frameGuard = errorBudget(FRAME_ERRORS_SHOWN, reportError);
const features = enabledConsoleFeatures();
for (const [name, make] of featureListSections(features)) registerListSection(name, make);
const featureFrame = featureFrameHooks(features);

function onFrame(): void {
  for (const hook of featureFrame) frameGuard(hook.name, hook.run);
  frameGuard(FRAME_GUARD_LABEL, applyOverrides);
}

function printLoaded(source: LoadSource): void {
  const overrides = plural(Object.keys(settings.snapshot()).length, TEXT.overrideNoun);
  const bindCount = plural(binds.keys().length, TEXT.bindNoun);
  const profileCount = profiles.names().length;
  const from = source === LOAD_SOURCE.file ? DESKTOP_FOLDER + SETTINGS_FILE : LOCAL_STORAGE_NAME;
  print(TEXT.loaded(overrides, bindCount, profileCount ? plural(profileCount, TEXT.profileNoun) : '', from), COLOR.hint);
}

function start(source: LoadSource): void {
  buildPanel();
  onActiveChange(updateStatus);
  game.onEnterFrame(onFrame);
  document.addEventListener(KEY_DOWN_EVENT, onKeyDownCapture, true);
  document.addEventListener(KEY_UP_EVENT, onKeyUpCapture, true);
  updateStatus();
  if (!SERVER) print(TEXT.banner(CLIENT_TITLE), COLOR.bright);
  if (namesMissing.length) {
    const message = TEXT.namesMissing(namesMissing, FIND_NAMES);
    print(message, COLOR.error);
    console.error(TEXT.terminal(TAG, message));
  }
  printLoaded(source);
  printProblems();
  setInterval(updateStatusIfOpen, STATUS_EVERY_MS);
  for (const tick of featureTicks(features)) {
    const guard = errorBudget(tick.errorsShown, reportError);
    setInterval(() => { guard(tick.name, () => { tick.run(); }); }, tick.everyMs);
  }
  for (const feature of features) feature.start?.();
}

function isGameReady(): boolean {
  try {
    return game.ready();
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  setMapSource(currentMapId);
  const source = await load();
  const timer = setInterval(() => {
    if (!isGameReady()) return;
    clearInterval(timer);
    start(source);
  }, BOOT_POLL_MS);
}

Reflect.set(globalThis, PAGE_API_GLOBAL, {
  run: (line: string) => { run(line); },
  reload(saved: unknown) {
    reloadStore(saved);
    print(TEXT.reloaded(SETTINGS_FILE), COLOR.hint);
    printProblems();
  },
  fileError(message: string) {
    print(TEXT.unreadable(SETTINGS_FILE, message), COLOR.error);
  },
  get kv() { return settings.snapshot(); },
  open: () => { openPanel(); },
  close: () => { closePanel(); },
});
void boot();
