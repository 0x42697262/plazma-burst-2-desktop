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
import { resolveConfig, sendEnvelope } from './domain/config.ts';
import { readConfigFile } from './adapters/config-file.ts';
import { deliverReports } from './adapters/sender.ts';
import { DIAGNOSTIC_FIELDS } from '#shared/editions/keys.ts';

const FACTS = { client: 'official', appVersion: '1.0.0', edition: 'dev', gameVersion: 'v1', flags: { features: ['diagnostics'], capabilities: [] } };

type Options = { host?: string | null; auto?: boolean; fields?: readonly any[]; deliver?: (host: string, body: string) => Promise<void>; canSend?: boolean };

function setup({ host = null, auto = false, fields = DIAGNOSTIC_FIELDS, deliver = async () => undefined, canSend = true }: Options = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-diagnostics-'));
  let clock = 1_000_000;
  let id = 0;
  const lines: string[] = [];
  const queue = createReportQueue(path.join(folder, 'nested', 'reports.json'), (message) => lines.push(message));
  const service = createDiagnosticsService({ queue, config: () => ({ host, auto, fields, problems: [] }), deliver, canSend, facts: () => FACTS, now: () => clock, newId: () => `id${++id}`, info: (line) => lines.push(line), error: (line) => lines.push(line) });
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
    const route = diagnosticsRoute({ service: context.service, capabilities: { capture: true, show: true, send: true } });
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
    const deaf = diagnosticsRoute({ service: context.service, capabilities: { capture: false, show: false, send: false } });
    assert.equal((await deaf.handle(post({ op: 'report', kind: 'page_error', error: {} }), url(), {})).status, 404);
    assert.equal((await deaf.handle(new Request(url()), url(), {})).status, 404);
    assert.deepEqual(await (await route.handle(post({ op: 'clear' }), url(), {})).json(), { cleared: 1 });
  } finally { context.cleanup(); }
});

test('settings: the environment wins over the file, the file over the edition; only https, or http on this machine', () => {
  assert.deepEqual(resolveConfig(null, {}, {}), { host: null, fields: DIAGNOSTIC_FIELDS, auto: false, problems: [] });
  const edition = { host: 'https://edition.test/r', send: ['kind'], auto: true };
  assert.deepEqual(resolveConfig(null, {}, edition), { host: 'https://edition.test/r', fields: ['kind'], auto: true, problems: [] });
  const file = { host: 'https://file.test/r', send: ['error', 'client'], auto: false };
  assert.deepEqual(resolveConfig(null, file, edition), { host: 'https://file.test/r', fields: ['error', 'client'], auto: false, problems: [] });
  assert.equal(resolveConfig('https://env.test/r', file, edition).host, 'https://env.test/r');
  assert.equal(resolveConfig('http://127.0.0.1:9/r', {}, {}).host, 'http://127.0.0.1:9/r');
  const plain = resolveConfig('http://example.test/r', {}, {});
  assert.equal(plain.host, null);
  assert.match(plain.problems[0] ?? '', /not an https/);
  const fields = resolveConfig(null, { send: ['kind', 'nope'] }, {});
  assert.deepEqual(fields.fields, ['kind']);
  assert.match(fields.problems[0] ?? '', /nope/);
  assert.deepEqual(resolveConfig(null, { hidden: true } as any, {}).problems, [], 'the file cannot say anything about hiding');
});

test('the settings file: missing is no settings, a broken one says why, hidden is not read from it', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-diagnostics-'));
  const file = path.join(folder, 'diagnostics.json');
  try {
    assert.deepEqual(readConfigFile(file), { values: {}, problem: null });
    fs.writeFileSync(file, JSON.stringify({ host: 'https://a.test', hidden: true }));
    const { values } = readConfigFile(file);
    assert.equal(values.host, 'https://a.test');
    assert.ok(!('hidden' in values));
    fs.writeFileSync(file, '{ nope');
    assert.match(readConfigFile(file).problem ?? '', /diagnostics\.json/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('only the chosen fields leave, plus the id, time and version', () => {
  const report = buildReport(FACTS, 'manual', { message: 'hi' }, 'id1', 'now');
  assert.deepEqual(sendEnvelope([report], ['kind']), { schemaVersion: 1, reports: [{ schemaVersion: 1, id: 'id1', time: 'now', kind: 'manual' }] });
});

test('sending: nothing without a server; sent reports leave the queue; a failure keeps them; auto only when set', async () => {
  const noServer = setup();
  try {
    noServer.service.capture('manual', { message: 'a' });
    assert.deepEqual(await noServer.service.send(), { sent: 0, pending: 1, host: null });
  } finally { noServer.cleanup(); }
  const bodies: string[] = [];
  let failing = true;
  const context = setup({ host: 'https://s.test', fields: ['error'], deliver: async (_host, body) => { if (failing) throw new Error('down'); bodies.push(body); } });
  try {
    context.service.capture('manual', { message: 'password=abc' });
    const failed = await context.service.send();
    assert.equal(failed.error, 'down');
    assert.equal(context.service.reports().length, 1);
    failing = false;
    assert.equal((await context.service.send()).sent, 1);
    assert.deepEqual(context.service.reports(), []);
    assert.ok(!bodies[0]?.includes('abc'));
    assert.ok(!bodies[0]?.includes('flags'), 'flags were not chosen');
    assert.ok(context.lines.some((line) => /sent 1 report to/.test(line)));
  } finally { context.cleanup(); }
  const sentNow: string[] = [];
  const auto = setup({ host: 'https://s.test', auto: true, deliver: async (_host, body) => { sentNow.push(body); } });
  try {
    auto.service.capture('manual', { message: 'x' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sentNow.length, 1);
  } finally { auto.cleanup(); }
  const notAllowed: string[] = [];
  const off = setup({ host: 'https://s.test', auto: true, canSend: false, deliver: async (_host, body) => { notAllowed.push(body); } });
  try {
    off.service.capture('manual', { message: 'x' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(notAllowed, [], 'without diagnostics.send nothing leaves');
  } finally { off.cleanup(); }
});

test('the sender posts JSON with a timeout and treats any other answer as a failure', async () => {
  const seen: any[] = [];
  await deliverReports(async (url, init) => { seen.push([url, init]); return new Response(null, { status: 204 }); }, 'https://s.test/r', '{}');
  assert.equal(seen[0][0], 'https://s.test/r');
  assert.equal(seen[0][1].method, 'POST');
  assert.ok(seen[0][1].signal);
  await assert.rejects(deliverReports(async () => new Response('', { status: 500 }), 'https://s.test/r', '{}'), /500/);
});
