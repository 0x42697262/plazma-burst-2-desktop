import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { redactText } from './domain/redact.ts';
import { buildReport } from './domain/report.ts';
import { createReportQueue } from './adapters/queue-file.ts';
import { createDiagnosticsService } from './services/diagnostics.ts';
import { diagnosticsRoute } from './entry/route.ts';

const FACTS = { client: 'official', appVersion: '1.0.0', edition: 'dev', gameVersion: 'v1', flags: { features: ['diagnostics'], capabilities: [] } };

function setup() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-diagnostics-'));
  let clock = 1_000_000;
  let id = 0;
  const lines: string[] = [];
  const queue = createReportQueue(path.join(folder, 'nested', 'reports.json'), (message) => lines.push(message));
  const service = createDiagnosticsService({ queue, facts: () => FACTS, now: () => clock, newId: () => `id${++id}`, info: (line) => lines.push(line), error: (line) => lines.push(line) });
  return { folder, queue, service, lines, advance: (ms: number) => { clock += ms; }, cleanup: () => fs.rmSync(folder, { recursive: true, force: true }) };
}

test('redaction removes secrets, the password cookie\'s md5, home folders and addresses', () => {
  const text = redactText('password=hunter2 token: abc Authorization: Bearer xyz.1 5f4dcc3b5aa765d61d8327deb882cf99 /home/me/app.js C:\\Users\\me\\app.js 203.0.113.5 fe80::1:2');
  for (const secret of ['hunter2', 'abc', 'xyz.1', '5f4dcc3b5aa765d61d8327deb882cf99', '/home/me', 'Users\\me', '203.0.113.5', 'fe80::1:2']) assert.ok(!text.includes(secret), secret);
  assert.match(redactText('a normal message at line 12:34'), /line 12:34/);
});

test('a report carries what was asked, redacted and cut to size', () => {
  const report = buildReport(FACTS, 'manual', { name: 'Error', message: `password=x ${'y'.repeat(1000)}`, line: 3 }, 'id', 'now');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.client, 'official');
  assert.ok(!report.error.message.includes('password=x'));
  assert.equal(report.error.message.length, 400);
  assert.equal(report.error.line, 3);
  assert.equal(report.error.column, null);
});

test('reports are kept in a file, the newest 50, without repeats or floods', () => {
  const context = setup();
  try {
    assert.ok(context.service.capture('page_error', { message: 'boom' }));
    assert.equal(context.service.capture('page_error', { message: 'boom' }), null, 'the same one within a minute');
    for (let index = 0; index < 20; index++) context.service.capture('page_error', { message: `other ${index}` });
    assert.equal(context.service.reports().length, 10, 'at most 10 a minute');
    for (let index = 0; index < 60; index++) {
      context.advance(61_000);
      context.service.capture('page_error', { message: `later ${index}` });
    }
    assert.equal(context.service.reports().length, 50);
    assert.equal(context.service.reports().at(-1)?.error.message, 'later 59');
    assert.equal(context.service.clear(), 50);
    assert.deepEqual(context.service.reports(), []);
  } finally { context.cleanup(); }
});

test('the route takes page reports, lists and clears, refuses remote windows and left-out capabilities', async () => {
  const context = setup();
  try {
    const route = diagnosticsRoute({ service: context.service, capabilities: { capture: true, show: true } });
    const url = (query = '') => new URL(`https://game.test/__dev/diagnostics${query}`);
    const post = (body: unknown) => new Request(url(), { method: 'POST', body: JSON.stringify(body) });
    const saved = await route.handle(post({ op: 'report', kind: 'page_error', error: { message: 'token=abc broke' } }), url(), {});
    assert.deepEqual(await saved.json(), { saved: true });
    assert.equal((await route.handle(post({ op: 'report', kind: 'main_error', error: { message: 'x' } }), url(), {})).status, 400, 'a page cannot claim another kind');
    const listed: any = await (await route.handle(new Request(url()), url(), {})).json();
    assert.equal(listed.reports.length, 1);
    assert.ok(!listed.reports[0].message.includes('abc'));
    const full: any = await (await route.handle(new Request(url('?report=last')), url('?report=last'), {})).json();
    assert.equal(full.kind, 'page_error');
    assert.equal((await route.handle(new Request(url('?report=9')), url('?report=9'), {})).status, 404);
    assert.equal((await route.handle(new Request(url()), url(), { remote: true })).status, 403);
    const deaf = diagnosticsRoute({ service: context.service, capabilities: { capture: false, show: false } });
    assert.equal((await deaf.handle(post({ op: 'report', kind: 'page_error', error: {} }), url(), {})).status, 404);
    assert.equal((await deaf.handle(new Request(url()), url(), {})).status, 404);
    assert.deepEqual(await (await route.handle(post({ op: 'clear' }), url(), {})).json(), { cleared: 1 });
  } finally { context.cleanup(); }
});
