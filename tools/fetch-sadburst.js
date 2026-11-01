// "npm run fetch-game -- --sadburst": a copy of the Sad Burst 2 game page (desktop/clients.js)
// into game.sadburst/. Called by tools/fetch-game.js.
//
// The site has no directory listings, and it answers any unknown path under /gameplay/
// with its game page (HTML, status 200), so files are found from what references them:
//   1. index.html, and what it links (icons, fonts, the page script assets/index-*.js)
//   2. the page script's own modules (Vite: "./name-hash.js" in imports and __vite__mapDeps)
//   3. asset-version.txt (build number, client version), and the game itself:
//      gamelogic/scripts-manifest.json lists the strings file of each language and the
//      scripts in load order
// Everything else the game loads (images, sounds, maps) is saved by the desktop wrapper
// the first time the game asks for it (desktop/main.js, "npm run sadburst").
'use strict';

const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (pb2-desktop fetch-game)';
const MANIFEST = 'gamelogic/scripts-manifest.json';
const VERSION_FILE = 'asset-version.txt';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET with retries: a Buffer, or null when the file does not exist (an error status, or
// the game page served in place of a file that is not HTML).
async function get(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status >= 400 && res.status < 500) return null;
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get('content-type') || '';
      if (/text\/html/.test(type) && !/\.html?$|\/$/.test(new URL(url).pathname)) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= tries) throw new Error(`${url}: ${e.message}`);
      await sleep(500 * 2 ** attempt);
    }
  }
}

// Relative references in HTML: src="", href="" (not absolute, not data:).
function htmlRefs(text) {
  const refs = [];
  for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)/gi)) refs.push(m[1]);
  return refs.filter((r) => !/^([a-z]+:|\/|data:)/i.test(r));
}

// The modules a Vite chunk loads: "./name.js" and "./name.css" in quotes or backticks.
function moduleRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(/["'`]\.\/([\w.-]+\.(?:js|css))["'`]/g)) out.add(m[1]);
  return [...out];
}

// The manifest: { strings: { lang: file }, order: [file], flash } -> every file, strings first.
function manifestFiles(manifest) {
  if (!manifest || !Array.isArray(manifest.order) || !manifest.strings || !manifest.strings.en) {
    throw new Error(`${MANIFEST} does not look like a scripts manifest`);
  }
  return [...new Set([...Object.values(manifest.strings), ...manifest.order])];
}

async function pool(items, jobs, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
}

// client: CLIENTS.sadburst. Returns { out, version, files, bytes, problems }.
async function fetchSadburst(client, { out = client.gameDir, jobs = 8 } = {}) {
  const base = client.site + client.prefix;
  const tmp = `${out}.download`;
  console.log(`Sad Burst 2 game page\nSource ${base}\nTarget ${out}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const saved = new Map();
  const missing = new Set();
  let bytes = 0;
  async function download(rel) {
    rel = path.posix.normalize(rel).replace(/^\.\//, '');
    if (rel.startsWith('..') || saved.has(rel) || missing.has(rel)) return saved.get(rel) || null;
    saved.set(rel, null);
    const data = await get(base + rel.split('/').map(encodeURIComponent).join('/'));
    if (!data) { saved.delete(rel); missing.add(rel); return null; }
    const file = path.join(tmp, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    saved.set(rel, data);
    bytes += data.length;
    return data;
  }

  // 1. The page and what it links.
  const index = await get(base);
  if (!index) throw new Error(`${base}: no game page`);
  fs.writeFileSync(path.join(tmp, 'index.html'), index);
  saved.set('index.html', index);
  const links = htmlRefs(index.toString('utf8'));
  await pool(links, jobs, (r) => download(r));

  // 2. The page script's modules, following their imports.
  const queue = links.filter((r) => /\.js$/.test(r));
  for (let i = 0; i < queue.length; i++) {
    const data = saved.get(path.posix.normalize(queue[i]).replace(/^\.\//, ''));
    if (!data) continue;
    const dir = path.posix.dirname(path.posix.normalize(queue[i]));
    for (const ref of moduleRefs(data.toString('utf8'))) {
      const rel = path.posix.join(dir, ref);
      if (saved.has(rel) || missing.has(rel)) continue;
      if (await download(rel) && rel.endsWith('.js')) queue.push(rel);
    }
  }

  // 3. The build number and the game's scripts.
  const versionText = (await download(VERSION_FILE))?.toString('utf8').trim().split(/\r?\n/) || [];
  const manifestData = await download(MANIFEST);
  if (!manifestData) throw new Error(`${base}${MANIFEST} not found`);
  const scripts = manifestFiles(JSON.parse(manifestData.toString('utf8')));
  await pool(scripts, jobs, (f) => download(f));

  const problems = [];
  for (const f of scripts) if (!saved.get(f)) problems.push(`the manifest lists missing ${f}`);
  for (const r of links) if (missing.has(path.posix.normalize(r).replace(/^\.\//, ''))) problems.push(`index.html links missing ${r}`);

  const build = versionText[0] || null;
  const version = `sadburst-${build || 'unknown'}`;
  fs.writeFileSync(path.join(tmp, 'pb2-version.json'), JSON.stringify({
    client: client.id,
    version,
    build, // asset-version.txt, line 1: the site's build number
    clientVersion: versionText[1] || null, // line 2: the version the client reports to the lobby
    source: base,
    fetched: new Date().toISOString(),
    files: [...saved.values()].filter(Boolean).length,
    bytes,
  }, null, 2) + '\n');

  const prev = `${out}.previous`;
  if (fs.existsSync(out)) {
    fs.rmSync(prev, { recursive: true, force: true });
    fs.renameSync(out, prev);
    console.log(`Old copy moved to ${path.basename(prev)}/`);
  }
  fs.renameSync(tmp, out);
  console.log(`Done: ${version} (client ${versionText[1] || '?'}), ${saved.size} files, ${(bytes / 1048576).toFixed(1)} MB in ${out}`);
  console.log('Images, sounds and maps are saved the first time the game loads them ("npm run sadburst").');
  return { out, version, files: saved.size, bytes, problems };
}

module.exports = { fetchSadburst, htmlRefs, moduleRefs, manifestFiles, MANIFEST, VERSION_FILE };
