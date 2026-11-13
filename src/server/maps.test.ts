import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMaps, httpMapSource, type MapSource } from './maps.ts';
import { MAP_LIMITS } from './constants.ts';

const COMPRESSED_LOOKALIKE = '<player x="10" y="20" />';
const plainUnpack = (text: string): string => text;

function fakeTime() {
  const time = { now: 1_000_000 };
  return { time, clock: () => time.now, sleep: async (ms: number) => { time.now += ms; } };
}

function source(name: string, answer: (id: string) => Promise<string | null>) {
  const asked: { id: string; at: number }[] = [];
  return { asked, make: (clock: () => number): MapSource => ({ name, fetchMap: async (id) => { asked.push({ id, at: clock() }); return answer(id); } }) };
}

function withMaps(run: (mapsDir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-map-sources-'));
  return run(dir).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

test('map sources: a failing source is passed over, the next one answers, and the map is kept', () => withMaps(async (mapsDir) => {
  const { clock, sleep } = fakeTime();
  const broken = source('broken', async () => { throw new Error('HTTP 403'); });
  const working = source('working', async () => COMPRESSED_LOOKALIKE);
  const maps = createMaps({ mapsDir, unpack: plainUnpack, sources: [broken.make(clock), working.make(clock)], clock, sleep });
  assert.equal(await maps.download('one'), COMPRESSED_LOOKALIKE + '\n');
  assert.equal(maps.local('one'), COMPRESSED_LOOKALIKE);
  assert.equal(broken.asked.length, 1);
  assert.equal(working.asked.length, 1);
}));

test('map sources: "not published" ends the search, and is remembered for a while', () => withMaps(async (mapsDir) => {
  const { time, clock, sleep } = fakeTime();
  const first = source('first', async () => null);
  const second = source('second', async () => COMPRESSED_LOOKALIKE);
  const maps = createMaps({ mapsDir, unpack: plainUnpack, sources: [first.make(clock), second.make(clock)], clock, sleep });
  assert.equal(await maps.download('gone'), null);
  assert.equal(await maps.download('gone'), null);
  assert.equal(first.asked.length, 1, 'asked once: the miss is remembered');
  assert.equal(second.asked.length, 0, 'a source that answered is trusted');
  time.now += MAP_LIMITS.missMemoryMs;
  assert.equal(await maps.download('gone'), null);
  assert.equal(first.asked.length, 2, 'asked again once the memory is over');
}));

test('map sources: an answer that is no map is not kept and counts as a failure', () => withMaps(async (mapsDir) => {
  const { clock, sleep } = fakeTime();
  const challenge = source('challenge', async () => '<!DOCTYPE html><html><title>Just a moment...</title></html>');
  const working = source('working', async () => COMPRESSED_LOOKALIKE);
  const maps = createMaps({ mapsDir, unpack: plainUnpack, sources: [challenge.make(clock), working.make(clock)], clock, sleep });
  assert.equal(await maps.download('one'), COMPRESSED_LOOKALIKE + '\n');
  assert.ok(!fs.readFileSync(path.join(mapsDir, 'one.xml'), 'utf8').includes('Just a moment'));
}));

test('map sources: one request at a time, with a gap between them', () => withMaps(async (mapsDir) => {
  const { clock, sleep } = fakeTime();
  const site = source('site', async () => COMPRESSED_LOOKALIKE);
  const maps = createMaps({ mapsDir, unpack: plainUnpack, sources: [site.make(clock)], clock, sleep });
  await Promise.all([maps.download('one'), maps.download('two')]);
  const [first, second] = site.asked;
  assert.ok(first && second);
  assert.ok(second.at - first.at >= MAP_LIMITS.gapMs, `${second.at - first.at} ms apart`);
}));

test('map sources: at most so many new maps a minute; saved maps do not count', () => withMaps(async (mapsDir) => {
  const { time, clock, sleep } = fakeTime();
  const site = source('site', async () => COMPRESSED_LOOKALIKE);
  const maps = createMaps({ mapsDir, unpack: plainUnpack, sources: [site.make(clock)], clock, sleep });
  const started = time.now;
  for (let index = 0; index < MAP_LIMITS.newMapsPerMinute; index++) await maps.download(`map-${index}`);
  assert.ok(time.now - started < MAP_LIMITS.windowMs, 'the gaps alone keep them within one minute');
  await assert.rejects(maps.download('one-too-many'), /new maps/);
  assert.ok(maps.local('map-0'), 'a saved map is still there');
  time.now = started + MAP_LIMITS.windowMs;
  assert.ok(await maps.download('one-too-many'), 'a minute later it is fine');
}));

test('map sources: a source that keeps failing is paused, then tried again', () => withMaps(async (mapsDir) => {
  const { time, clock, sleep } = fakeTime();
  const broken = source('broken', async () => { throw new Error('timeout'); });
  const working = source('working', async () => COMPRESSED_LOOKALIKE);
  const maps = createMaps({ mapsDir, unpack: plainUnpack, sources: [broken.make(clock), working.make(clock)], clock, sleep });
  for (let index = 0; index < MAP_LIMITS.failuresBeforePause + 1; index++) await maps.download(`map-${index}`);
  assert.equal(broken.asked.length, MAP_LIMITS.failuresBeforePause, 'not asked once paused');
  time.now += MAP_LIMITS.pauseMs;
  await maps.download('later');
  assert.equal(broken.asked.length, MAP_LIMITS.failuresBeforePause + 1);
}));

test('map sources: when every source fails, the error names them', () => withMaps(async (mapsDir) => {
  const { clock, sleep } = fakeTime();
  const broken = source('broken', async () => { throw new Error('HTTP 403'); });
  const maps = createMaps({ mapsDir, unpack: plainUnpack, sources: [broken.make(clock)], clock, sleep });
  await assert.rejects(maps.download('one'), /broken: HTTP 403/);
}));

test('map sources: the HTTP source asks server.php for the map, and a refusal is a failure', async () => {
  const bodies: string[] = [];
  const answer = (status: number, text: string) => async (_url: string, init: RequestInit) => {
    bodies.push(init.body instanceof URLSearchParams ? init.body.toString() : '');
    return new Response(text, { status });
  };
  assert.equal(await httpMapSource('site', 'https://example.test/pb2/server.php', answer(200, COMPRESSED_LOOKALIKE)).fetchMap('a-map'), COMPRESSED_LOOKALIKE);
  assert.match(bodies[0] ?? '', /rq=cmap/);
  assert.match(bodies[0] ?? '', /cmap=a-map/);
  assert.equal(await httpMapSource('site', 'https://example.test/', answer(200, '<not_published />')).fetchMap('gone'), null);
  await assert.rejects(httpMapSource('site', 'https://example.test/', answer(403, 'Just a moment...')).fetchMap('a-map'), /403/);
});
