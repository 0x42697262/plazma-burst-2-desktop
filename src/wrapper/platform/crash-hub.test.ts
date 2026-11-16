import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrashHub } from './crash-hub.ts';

function sources() {
  const listeners: { main: ((error: Error) => void)[]; renderer: ((reason: string, exitCode: number) => void)[] } = { main: [], renderer: [] };
  return {
    listeners,
    onMainError: (listener: (error: Error) => void) => { listeners.main.push(listener); },
    onRendererGone: (listener: (reason: string, exitCode: number) => void) => { listeners.renderer.push(listener); },
  };
}

test('one process listener whatever the number of clients, and an error goes to the active client only', () => {
  const source = sources();
  let active = 'official';
  const hub = createCrashHub({ ...source, activeClient: () => active });
  const seen: string[] = [];
  for (const client of ['official', 'sadburst', 'official']) {
    const ports = hub.portsFor(client);
    ports.onMainError((error) => { seen.push(`${client} main ${error.message}`); });
    ports.onRendererGone((reason) => { seen.push(`${client} renderer ${reason}`); });
  }
  assert.equal(source.listeners.main.length, 1);
  assert.equal(source.listeners.renderer.length, 1);
  source.listeners.main[0]?.(new Error('boom'));
  active = 'sadburst';
  source.listeners.renderer[0]?.('crashed', 1);
  assert.deepEqual(seen, ['official main boom', 'sadburst renderer crashed'], 'the official client registered twice; only its latest listener counts');
});

test('nothing listens before a client asks, and an error for a client with no listener is dropped', () => {
  const source = sources();
  const hub = createCrashHub({ ...source, activeClient: () => 'official' });
  assert.equal(source.listeners.main.length, 0);
  hub.portsFor('sadburst').onMainError(() => { throw new Error('not this one'); });
  source.listeners.main[0]?.(new Error('boom'));
});
