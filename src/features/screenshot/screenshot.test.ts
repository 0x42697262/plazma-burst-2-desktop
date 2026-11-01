import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '../../../test/fake-game.mjs';

const errorsOf = (out: string[]) => out.filter((line) => line.startsWith('error: '));

test('screenshot hides the console, asks the wrapper, and has a hotkey (F12) you can change', async () => {
  const game = await bootConsole();
  const { game: bindings } = await import('../../../desktop/dev/console/game/bindings.js') as { game: { overlay(): { childNodes: { style: Record<string, string>; textContent?: string }[] } } };
  const panel = () => bindings.overlay().childNodes.find((node) => node.style.zIndex === '50');
  const calls: [string, string | undefined][] = [];
  let reply: Record<string, unknown> = { ok: true, json: async () => ({ file: 'screenshots/pb2-x.png' }) };
  const realFetch: unknown = game.G.fetch;
  game.G.fetch = async (url: string, options?: { method?: string }) => { calls.push([url, options?.method]); return reply; };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const shoot = async (start: () => unknown) => {
    start();
    for (let round = 0; round < 3; round++) { (game.log.frames as (() => void)[]).splice(0).forEach((frame) => frame()); await settle(); }
  };
  try {
    game.run('trace --off; logic hide');
    let hiddenAtCapture: string | undefined;
    game.G.fetch = async (url: string, options?: { method?: string }) => { hiddenAtCapture = panel()?.style.visibility; calls.push([url, options?.method]); return reply; };
    await shoot(() => game.run('screenshot'));
    assert.deepEqual(calls, [['__dev/screenshot', 'POST']]);
    assert.equal(hiddenAtCapture, 'hidden', 'no console in the picture');
    assert.equal(panel()?.style.visibility, 'visible', 'and back after');
    assert.ok(game.log.printed.includes('Saved screenshots/pb2-x.png'));
    assert.ok(bindings.overlay().childNodes.some((node) => node.textContent !== undefined && node.style.right === '10px'), 'a notice in the corner');

    await shoot(() => game.run('screenshot --console'));
    assert.equal(hiddenAtCapture, 'visible', '--console keeps it');

    calls.length = 0;
    await shoot(() => game.press('F12'));
    assert.equal(calls.length, 1, 'F12 by default, console closed');
    assert.match(game.run('screenshot_key f2')[0] ?? '', /^screenshot_key = f2$/);
    await shoot(() => game.press('F12'));
    assert.equal(calls.length, 1, 'F12 is free now');
    await shoot(() => game.press('F2'));
    assert.equal(calls.length, 2);
    assert.match(game.run('bind f2 heal').join('\n'), /f2 is the screenshot key, which wins/);
    game.run('unbind f2');
    game.run('screenshot_key off');
    await shoot(() => game.press('F2'));
    assert.equal(calls.length, 2, 'off: no key');
    assert.match(errorsOf(game.run('screenshot_key shift+`'))[0] ?? '', /opens the console/);
    assert.ok(game.run('list console').some((line) => /screenshot_key\s+off\s+Key that saves a screenshot.*\(default f12\)/.test(line)));
    game.run('unset screenshot_key');

    reply = { ok: false, text: async () => 'disk full' };
    await shoot(() => game.run('screenshot'));
    assert.ok(game.log.printed.includes('error: could not save a screenshot (disk full)'));
    assert.equal(panel()?.style.visibility, 'visible', 'back after a failure too');
    assert.match(errorsOf(game.run('screenshot now'))[0] ?? '', /usage: screenshot \[--console\]/);
  } finally {
    game.G.fetch = realFetch;
  }
});
