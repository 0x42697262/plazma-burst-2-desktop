// The server list: the official server and the saved private servers, each with its
// address, ping, players and description, checked when the list opens (and on Refresh).
// Everything goes through window.pb2servers (preload.js); passwords never reach this page.
'use strict';

const api = window.pb2servers;
const $ = (sel) => document.querySelector(sel);
const PING_GOOD = 80;
const PING_OK = 150;

let data = null; // servers:list
let selected = null; // server id
const checks = new Map(); // id -> { ping, status, error, pinned } | 'checking'

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k);
  return n;
}

const rows = () => [{ ...data.official, official: true, address: `${data.official.host}:${data.official.port}` }, ...data.servers];

function pingCell(c) {
  if (c === 'checking' || c === undefined) return el('span', { class: 'muted' }, '…');
  if (c.ping === null || c.ping === undefined) return el('span', { class: 'bad' }, 'offline');
  const ms = Math.round(c.ping);
  return el('span', { class: ms < PING_GOOD ? 'good' : ms < PING_OK ? 'warn' : 'bad' }, `${ms} ms`);
}

function playersCell(s, c) {
  if (s.official || !c || c === 'checking' || !c.status) return '—';
  const st = c.status;
  return `${st.players}/${st.max_players}${st.matches ? ` · ${st.matches} match${st.matches === 1 ? '' : 'es'}` : ''}`;
}

function descCell(s, c) {
  if (s.official) return s.description;
  if (c === 'checking' || c === undefined) return s.nickname ? `as ${s.nickname}` : '';
  if (c.pinned === false) return el('span', { class: 'bad' }, 'Its certificate is not the saved one. Someone else may be at this address; ask the host for the fingerprint again.');
  if (!c.status) return el('span', { class: 'muted' }, c.ping === null ? 'not reachable' : c.error || '');
  const st = c.status;
  const out = [st.description || ''];
  if (st.version && data.gameVersion && st.version !== data.gameVersion) {
    out.push(el('div', { class: 'warn' }, `Game ${st.version} there, ${data.gameVersion} here: the same version is needed ("npm run fetch-game" on both).`));
  }
  out.push(el('div', { class: 'muted small-line' }, `as ${s.nickname}${st.password && !s.hasPassword ? ' · needs a password (Edit)' : ''}`));
  return out;
}

function draw() {
  const body = $('#servers tbody');
  body.textContent = '';
  for (const s of rows()) {
    const c = checks.get(s.id);
    const name = s.official ? s.name : (c && c.status && c.status.name) || s.name;
    const tr = el('tr', {
      class: s.id === selected ? 'selected' : '',
      onclick: () => { selected = s.id; draw(); },
      ondblclick: () => play(s.id),
    },
    el('td', { class: 'name' }, name, s.official ? el('span', { class: 'tag' }, 'official') : el('span', { class: 'tag' }, 'private')),
    el('td', { class: 'addr' }, s.address),
    el('td', { class: 'num' }, pingCell(c)),
    el('td', { class: 'num' }, playersCell(s, c)),
    el('td', { class: 'desc' }, descCell(s, c)));
    body.append(tr);
  }
  const priv = data.servers.some((s) => s.id === selected);
  $('#edit').disabled = !priv;
  $('#remove').disabled = !priv;
  $('#play').disabled = !selected;
}

async function check(id) {
  checks.set(id, 'checking');
  draw();
  try { checks.set(id, await api.check(id)); } catch (e) { checks.set(id, { ping: null, error: e.message }); }
  draw();
}

async function load() {
  data = await api.list();
  if (!selected || !rows().some((s) => s.id === selected)) selected = rows().some((s) => s.id === data.last) ? data.last : data.official.id;
  const note = $('#note');
  note.hidden = !data.problems.length;
  note.textContent = data.problems.length ? `desktop/servers.json: ${data.problems.join('; ')}` : '';
  draw();
  for (const s of rows()) check(s.id);
}

async function play(id) {
  if (!id) return;
  $('#play').disabled = true;
  try { await api.play(id); } catch (e) { alert(e.message); $('#play').disabled = false; }
}

// ----- Add / edit -----
const form = $('#form');
const field = (n) => form.querySelector(`[name="${n}"]`);
let editing = null;

function openForm(server) {
  editing = server || null;
  $('#form-title').textContent = server ? `Edit ${server.name}` : 'Add a private server';
  for (const n of ['name', 'address', 'fingerprint', 'nickname']) field(n).value = server ? server[n] || '' : '';
  field('password').value = '';
  field('password').placeholder = server && server.hasPassword ? '(unchanged)' : '';
  showErrors([]);
  form.showModal();
  field(server ? 'nickname' : 'address').focus();
}

function showErrors(list) {
  const ul = $('#errors');
  ul.textContent = '';
  for (const e of list) ul.append(el('li', {}, e));
  ul.hidden = !list.length;
}

$('#get-fp').addEventListener('click', async () => {
  const btn = $('#get-fp');
  btn.disabled = true;
  try {
    field('fingerprint').value = await api.fingerprint(field('address').value);
    $('#fp-note').textContent = 'Got it from the server. Compare it with the fingerprint the host sent you before saving.';
  } catch (e) {
    showErrors([`Could not get the fingerprint: ${e.message}`]);
  } finally {
    btn.disabled = false;
  }
});

$('#save').addEventListener('click', async (e) => {
  e.preventDefault();
  const entry = { id: editing ? editing.id : undefined };
  for (const n of ['name', 'address', 'fingerprint', 'nickname']) entry[n] = field(n).value;
  if (field('password').value || !editing) entry.password = field('password').value; // empty when editing: keep the saved one
  const r = await api.save(entry);
  if (r.errors) { showErrors(r.errors); return; }
  form.close();
  selected = r.server.id;
  await load();
});

$('#cancel').addEventListener('click', () => form.close());
$('#add').addEventListener('click', () => openForm(null));
$('#edit').addEventListener('click', () => openForm(data.servers.find((s) => s.id === selected)));
$('#remove').addEventListener('click', async () => {
  const s = data.servers.find((x) => x.id === selected);
  if (!s || !confirm(`Remove ${s.name} from the list?`)) return;
  await api.remove(s.id);
  selected = data.official.id;
  await load();
});
$('#refresh').addEventListener('click', () => { for (const s of rows()) check(s.id); });
$('#play').addEventListener('click', () => play(selected));
document.addEventListener('keydown', (e) => {
  if (form.open) return;
  if (e.key === 'Enter') play(selected);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const list = rows();
    const i = list.findIndex((s) => s.id === selected);
    selected = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].id;
    draw();
    e.preventDefault();
  }
});

if (!api) document.body.textContent = 'This page only works inside the desktop app (npm start).';
else load();
