// The servers the app can play on: the official one, and private servers (server/,
// "npm run server") saved in desktop/servers.json:
//   { "servers": [{ "id", "name", "address": "203.0.113.5:2053", "fingerprint": "0B:3A:...",
//                   "nickname": "Pal", "password": "..." }], "last": "<id>" }
// A private server's fingerprint is its certificate: the game connects to that address
// only when the certificate there is exactly this one. On a private server your PB2
// account is not used: the game starts logged out and logs in there with the nickname
// and the server's password. The file holds those passwords, so it is not in git.
// Also here: a server's ping, its status (name, description, players) and fetching its
// certificate's fingerprint, for the server list (desktop/launcher/).
'use strict';

const fs = require('fs');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

const DEFAULT_PORT = 2053;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/; // SHA-256, as the server prints it
const NICKNAME = /^[A-Za-z0-9 _.\-]{1,20}$/;
const HOST = /^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.\-]+)$/;
const MAX_NAME = 40;
const TIMEOUT_MS = 4000;
const MAX_STATUS = 16384; // bytes of a /status answer
// The official lobby server: where the game connects (scripts/screens/MPLobby.js).
const OFFICIAL = Object.freeze({ id: 'official', name: 'PlazmaBurst2.com', host: 'vvvv.plazmaburst2.com', port: 2053, description: 'The official servers (USA, Arizona). Your PB2 account from desktop/credentials.json.' });

// "host:port", "host" or "[v6]:port" -> { host, port, hostPort }.
function parseAddress(text) {
  const s = String(text || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const m = s.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!m || !HOST.test(m[1])) throw new Error(`address: "${text}" is not like "203.0.113.5:2053"`);
  const port = m[2] ? Number(m[2]) : DEFAULT_PORT;
  if (port < 1 || port > 65535) throw new Error(`address: port ${port} is out of range`);
  return { host: m[1].replace(/^\[|\]$/g, ''), port, hostPort: `${m[1]}:${port}` };
}

const normalFingerprint = (f) => String(f || '').trim().toUpperCase().replace(/^SHA256[:/ ]?/, '').replace(/[^0-9A-F]/g, '').replace(/(..)(?=.)/g, '$1:');

// A private server entry, checked: { server, errors }. server is
// { id, name, address, host, port, hostPort, fingerprint, nickname, password }.
function checkServer(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { server: null, errors: ['not a server entry'] };
  let addr = null;
  try { addr = parseAddress(obj.address); } catch (e) { errors.push(e.message); }
  const fingerprint = normalFingerprint(obj.fingerprint);
  if (!FINGERPRINT.test(fingerprint)) errors.push('fingerprint: the server\'s certificate fingerprint, as its terminal prints it (64 hex digits)');
  const nickname = typeof obj.nickname === 'string' ? obj.nickname.trim() : '';
  if (!NICKNAME.test(nickname)) errors.push('nickname: 1-20 letters, digits, spaces and _ . -');
  if (obj.password !== undefined && typeof obj.password !== 'string') errors.push('password: text');
  const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, MAX_NAME) : '';
  if (errors.length) return { server: null, errors };
  const id = typeof obj.id === 'string' && /^[a-z0-9]{6,32}$/.test(obj.id) ? obj.id : crypto.randomBytes(6).toString('hex');
  return { server: { id, name: name || addr.hostPort, address: addr.hostPort, ...addr, fingerprint, nickname, password: obj.password || '' }, errors };
}

// The saved list: { servers, last, problems }. A broken entry is left out with a problem.
function loadServers(file) {
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    return { servers: [], last: null, problems: e.code === 'ENOENT' ? [] : [`${file}: ${e.message}`] };
  }
  const problems = [];
  const servers = [];
  for (const [i, entry] of (Array.isArray(obj && obj.servers) ? obj.servers : []).entries()) {
    const { server, errors } = checkServer(entry);
    if (server) servers.push(server);
    else problems.push(`server ${i + 1}: ${errors.join('; ')}`);
  }
  return { servers, last: typeof obj.last === 'string' ? obj.last : null, problems };
}

const stored = ({ id, name, address, fingerprint, nickname, password }) => ({ id, name, address, fingerprint, nickname, password });

function saveServers(file, servers, last) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ servers: servers.map(stored), last: last || null }, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// The time to open a TCP connection, in ms (one round trip), or null.
function ping(host, port, timeout = TIMEOUT_MS) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const s = net.connect({ host, port });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(timeout, () => done(null));
    s.once('error', () => done(null));
    s.once('connect', () => done(Number(process.hrtime.bigint() - started) / 1e6));
  });
}

// The certificate fingerprint a server presents (nothing is sent but the handshake).
function fetchFingerprint(host, port, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port, rejectUnauthorized: false, servername: net.isIP(host) ? undefined : host });
    s.setTimeout(timeout, () => { s.destroy(); reject(new Error('no answer')); });
    s.once('error', (e) => reject(e));
    s.once('secureConnect', () => {
      const cert = s.getPeerCertificate();
      s.destroy();
      if (!cert || !cert.fingerprint256) reject(new Error('no certificate'));
      else resolve(cert.fingerprint256);
    });
  });
}

// A private server's /status (name, description, players, ...), only from the server
// whose certificate is the pinned one. Rejects with .pinned = false on another certificate.
function fetchStatus(server, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host: server.host, port: server.port, rejectUnauthorized: false, servername: net.isIP(server.host) ? undefined : server.host });
    let body = '';
    const fail = (e) => { s.destroy(); reject(e); };
    s.setTimeout(timeout, () => fail(new Error('no answer')));
    s.once('error', fail);
    s.once('secureConnect', () => {
      const cert = s.getPeerCertificate();
      if (!cert || cert.fingerprint256 !== server.fingerprint) {
        fail(Object.assign(new Error('the server\'s certificate is not the saved one'), { pinned: false }));
        return;
      }
      s.write(`GET /status HTTP/1.1\r\nHost: ${server.hostPort}\r\nConnection: close\r\n\r\n`);
    });
    s.on('data', (d) => { body += d; if (body.length > MAX_STATUS) fail(new Error('answer too long')); });
    s.once('end', () => {
      const at = body.indexOf('\r\n\r\n');
      if (!/^HTTP\/1\.[01] 200/.test(body) || at < 0) { reject(new Error('no status (an older server?)')); return; }
      let text = body.slice(at + 4);
      if (/transfer-encoding:\s*chunked/i.test(body.slice(0, at))) text = text.replace(/^[0-9a-f]+\r\n/i, '').replace(/\r\n0\r\n\r\n$/, '');
      try { resolve(JSON.parse(text)); } catch { reject(new Error('the status is not JSON')); }
    });
  });
}

module.exports = { OFFICIAL, parseAddress, normalFingerprint, checkServer, loadServers, saveServers, ping, fetchFingerprint, fetchStatus };
