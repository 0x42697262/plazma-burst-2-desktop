// "npm run join": play on a private server (server/, "npm run server") instead of the
// official one. desktop/join.json says where and as whom:
//   { "address": "203.0.113.5:2053", "fingerprint": "0B:3A:...", "nickname": "Pal", "password": "..." }
// The server prints these when it starts ("join" in its terminal prints them again).
// The fingerprint is the server's certificate: the game connects to that address only
// when the certificate there is exactly this one. Your PB2 account is not used: the game
// starts logged out and logs in to the server with the nickname and the server's password.
'use strict';

const fs = require('fs');

const DEFAULT_PORT = 2053;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/; // SHA-256, as the server prints it
const NICKNAME = /^[A-Za-z0-9 _.\-]{1,20}$/;
const HOST = /^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.\-]+)$/;

// "host:port", "host" or "[v6]:port" -> { host, port }.
function parseAddress(text) {
  const s = String(text || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const m = s.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!m || !HOST.test(m[1])) throw new Error(`address: "${text}" is not like "203.0.113.5:2053"`);
  const port = m[2] ? Number(m[2]) : DEFAULT_PORT;
  if (port < 1 || port > 65535) throw new Error(`address: port ${port} is out of range`);
  return { host: m[1].replace(/^\[|\]$/g, ''), port, hostPort: `${m[1]}:${port}` };
}

const normalFingerprint = (f) => String(f || '').trim().toUpperCase().replace(/^SHA256[:/ ]?/, '').replace(/[^0-9A-F]/g, '').replace(/(..)(?=.)/g, '$1:');

// { join, errors }: join is { host, port, hostPort, fingerprint, nickname, password }.
function checkJoin(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { join: null, errors: ['the file must hold a JSON object'] };
  let addr = null;
  try { addr = parseAddress(obj.address); } catch (e) { errors.push(e.message); }
  const fingerprint = normalFingerprint(obj.fingerprint);
  if (!FINGERPRINT.test(fingerprint)) errors.push('fingerprint: the server\'s certificate fingerprint, as its terminal prints it (64 hex digits)');
  const nickname = typeof obj.nickname === 'string' ? obj.nickname.trim() : '';
  if (!NICKNAME.test(nickname)) errors.push('nickname: 1-20 letters, digits, spaces and _ . -');
  if (obj.password !== undefined && typeof obj.password !== 'string') errors.push('password: text');
  if (errors.length) return { join: null, errors };
  return { join: { ...addr, fingerprint, nickname, password: obj.password || '' }, errors };
}

function loadJoin(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return { join: null, errors: [e.code === 'ENOENT' ? `no ${file}: copy desktop/join.example.json there and fill it in` : `${file}: ${e.message}`] };
  }
  try {
    return checkJoin(JSON.parse(text.replace(/^﻿/, '')));
  } catch (e) {
    return { join: null, errors: [`${file} is not valid JSON: ${e.message}`] };
  }
}

module.exports = { loadJoin, checkJoin, parseAddress, normalFingerprint };
