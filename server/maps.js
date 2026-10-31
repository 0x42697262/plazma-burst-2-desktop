// Where the server's matches get their maps: desktop/maps first (a map ID "local-<name>"
// or "<name>" is desktop/maps/<name>.xml, like the desktop wrapper's local maps), then
// the site's public map download for published IDs, kept in server/data/maps so a map
// is downloaded once.
'use strict';

const fs = require('fs');
const path = require('path');

const EXTS = Object.freeze(['.xml', '.txt', '']);
const LOCAL_PREFIX = 'local-';
const SITE = 'https://www.plazmaburst2.com/pb2/server.php';
const NOT_PUBLISHED = '<not_published';
const TIMEOUT_MS = 15000;

// Map ID -> file name, as desktop/main.js names saved maps.
const fileName = (id) => id.replace(/[^A-Za-z0-9 _.\-]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')) + '.xml';

function readIn(dir, name) {
  let files;
  try { files = fs.readdirSync(dir); } catch { return null; }
  const want = name.toLowerCase();
  for (const ext of EXTS) {
    const hit = files.find((f) => f.toLowerCase() === want + ext && !f.startsWith('.'));
    if (hit) return fs.readFileSync(path.join(dir, hit), 'utf8').replace(/^﻿/, '').trim();
  }
  return null;
}

// File name -> map ID (the reverse of fileName; a local map's name is its ID too).
const idOf = (file) => file.replace(/\.(xml|txt)$/i, '').replace(/%([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)));

function mapFiles(dir) {
  try { return fs.readdirSync(dir).filter((f) => !f.startsWith('.') && EXTS.includes(path.extname(f).toLowerCase())); } catch { return []; }
}

function createMaps({ mapsDir, cacheDir, fetch = globalThis.fetch }) {
  return {
    // Every map ID the server has a file for, desktop/maps first.
    list() {
      return [...new Set([...mapFiles(mapsDir), ...mapFiles(cacheDir)].map(idOf))];
    },
    // The map's text, or null.
    local(id) {
      const s = String(id || '').trim();
      if (!s || s.includes('/') || s.includes('\\') || s.startsWith('.')) return null;
      const name = s.toLowerCase().startsWith(LOCAL_PREFIX) ? s.slice(LOCAL_PREFIX.length) : s;
      return readIn(mapsDir, name) || readIn(mapsDir, fileName(s).slice(0, -4)) || readIn(cacheDir, fileName(s).slice(0, -4));
    },
    // A published map from the site, or null when it has none by that ID.
    async download(id) {
      const body = new URLSearchParams({ l: '', p: '', rq: 'cmap', cmap: id, qpack: '1.0' });
      const res = await fetch(SITE, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`the site answered HTTP ${res.status}`);
      const text = (await res.text()).replace(/^﻿/, '').trim();
      if (!text.startsWith('<') || text.startsWith(NOT_PUBLISHED)) return null;
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(path.join(cacheDir, fileName(id)), text);
      } catch {}
      return text;
    },
  };
}

module.exports = { createMaps, fileName, idOf };
