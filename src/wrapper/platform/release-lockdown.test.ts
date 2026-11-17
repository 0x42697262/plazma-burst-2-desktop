import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lockDownRelease, type LockdownApp } from './release-lockdown.ts';

function fakeApp(isPackaged: boolean) {
  const removed: string[] = [];
  const pages: Array<(event: unknown, contents: { on(name: string, listener: () => void): void; closeDevTools(): void }) => void> = [];
  const app: LockdownApp = {
    isPackaged,
    commandLine: { removeSwitch: (name) => { removed.push(name); } },
    on: (_name, listener) => { pages.push(listener); },
  };
  const openPage = () => {
    const listeners = new Map<string, () => void>();
    let closed = 0;
    const contents = { on: (name: string, listener: () => void) => { listeners.set(name, listener); }, closeDevTools: () => { closed++; } };
    for (const listener of pages) listener({}, contents);
    return { openDevTools: () => listeners.get('devtools-opened')?.(), closed: () => closed };
  };
  return { app, removed, openPage };
}

test('a packaged release drops the debugging switches and closes DevTools as soon as a page opens them', () => {
  const { app, removed, openPage } = fakeApp(true);
  assert.equal(lockDownRelease(app, { devtools: undefined }), true);
  assert.deepEqual(removed.sort(), ['inspect', 'inspect-brk', 'remote-debugging-pipe', 'remote-debugging-port']);
  const page = openPage();
  page.openDevTools();
  assert.equal(page.closed(), 1);
});

test('dev runs and editions that say "devtools": true keep DevTools and the debugging port', () => {
  for (const [isPackaged, devtools] of [[false, undefined], [true, true]] as const) {
    const { app, removed, openPage } = fakeApp(isPackaged);
    assert.equal(lockDownRelease(app, { devtools }), false);
    assert.deepEqual(removed, []);
    const page = openPage();
    page.openDevTools();
    assert.equal(page.closed(), 0);
  }
});
