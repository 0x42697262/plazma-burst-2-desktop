import { editorOn, editorShown, onChange, NOTICE } from './session.ts';
import { loadText, readLocalMap, type LoadResult, type LoadRun } from './load.ts';
import { WATCH_POLL_MS } from './constants.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

export type WatchEvents = { loaded: (result: LoadResult) => void; failed: (message: string) => void; stopped: (why: string) => void };
type Watch = { name: string; run: LoadRun; text: string; due: number; busy: boolean; lastError: string; events: WatchEvents };

let watch: Watch | null = null;

export const watchedName = (): string | null => watch?.name ?? null;

export function startWatch(name: string, run: LoadRun, text: string, events: WatchEvents): void {
  watch = { name, run, text, due: Date.now() + WATCH_POLL_MS, busy: false, lastError: '', events };
}

export function stopWatch(why?: string): boolean {
  const was = watch;
  watch = null;
  if (was && why) was.events.stopped(why);
  return !!was;
}

function fail(current: Watch, message: string): void {
  if (message === current.lastError) return;
  current.lastError = message;
  current.events.failed(message);
}

export function watchTick(now: number = Date.now()): void {
  const current = watch;
  if (!current) return;
  if (!editorOn()) {
    stopWatch(TEXT.watchEditorOff);
    return;
  }
  if (current.busy || now < current.due || !editorShown()) return;
  current.busy = true;
  readLocalMap(current.name)
    .then((text) => {
      if (watch !== current || text === current.text || !editorShown()) return;
      current.text = text;
      current.lastError = '';
      current.events.loaded(loadText(text, current.run));
    })
    .catch((error: Error) => { if (watch === current) fail(current, error.message); })
    .finally(() => {
      current.busy = false;
      current.due = Date.now() + WATCH_POLL_MS;
    });
}

onChange((what) => { if (what === NOTICE.doc) stopWatch(TEXT.watchOtherMap); });
