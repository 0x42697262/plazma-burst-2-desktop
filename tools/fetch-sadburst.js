// "npm run fetch-game -- --sadburst": a copy of the Sad Burst 2 game page (src/kernel/config/clients.ts)
// into game.sadburst/. Called by tools/fetch-game.js.
//
// The site has no directory listings, and it answers any unknown path under /gameplay/
// with its game page (HTML, status 200), so files are found from what references them:
//   1. index.html, and what it links (icons, fonts, the page script assets/index-*.js)
//   2. the page script's own modules (Vite: "./name-hash.js" in imports and __vite__mapDeps)
//   3. asset-version.txt (build number, client version), and the game itself:
//      gamelogic/scripts-manifest.json lists the strings file of each language and the
//      scripts in load order
//   4. what the game loads, from its own lists (assetPaths): the sounds and bitmaps list
//      (flash_export/just_sounds_and_bitmaps.html) with its .ogg overrides, the sprite
//      sheets and frame sequences its loader names, the skins and campaign manifests, and
//      every relative file path written in its code, strings and CSS
//   5. what the desktop wrapper had to fetch while you played (kept.txt, see below)
// The wrapper ("npm run sadburst") fetches anything still missing the first time the game
// asks for it, keeps it, and lists it in game.sadburst/kept.txt, so the next fetch-game
// gets it too.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const UA = 'Mozilla/5.0 (pb2-desktop fetch-game)';
const MANIFEST = 'gamelogic/scripts-manifest.json';
const VERSION_FILE = 'asset-version.txt';
const KEPT = 'kept.txt'; // what the wrapper fetched while you played (src/wrapper/platform/game-files.ts)
const SOUNDS_LIST = 'flash_export/just_sounds_and_bitmaps.html';
const SKINS_LIST = 'flash_export/flash_skins/manifest.json';
const CAMPAIGN_LIST = 'gamelogic/campaign/manifest.json';
const ASSET_EXT = 'png|jpe?g|gif|webp|svg|mp3|ogg|wav|css|json|xml|ttf|otf|woff2?';
const ID = '0-9A-Za-z_\\u0400-\\u04FF';

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

// A strings file (gamelogic/<hash>.js: {let e=globalThis;e.$name="...",...}) -> Map.
function loadStrings(text) {
  const ctx = {};
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(text, ctx);
  const map = new Map();
  for (const [k, v] of Object.entries(ctx)) if (typeof v === 'string' && k.startsWith('$')) map.set(k, v);
  return map;
}

const pad4 = (n) => String(n).padStart(4, '0');
const RELATIVE = new RegExp(`^(?:[\\w-]+/)*[\\w.-]+\\.(?:${ASSET_EXT})$`, 'i');

// The files the game loads, relative to the game page, from what fetch-game already has:
// texts: [[rel, text]] of the code, CSS and lists; strings: the strings file's values;
// kept: the wrapper's kept.txt lines. Some guesses do not exist (a path relative to
// another folder): download() just skips those.
function assetPaths({ texts, strings, languages = ['en'], kept = [] }) {
  const out = new Set();
  const all = texts.map(([, t]) => t).join('\n');
  const valueOf = (token) => (token.startsWith('$') ? strings.get(token) : token.slice(1, -1));
  // Relative file paths written in code and CSS ("x/y.png", `y.css`, url(x.png)), and
  // whole strings of the strings file that are one.
  for (const m of all.matchAll(new RegExp(`["'\`(]((?:[\\w-]+/)*[\\w.-]+\\.(?:${ASSET_EXT}))["'\`)]`, 'gi'))) out.add(m[1]);
  for (const v of strings.values()) if (RELATIVE.test(v)) out.add(v);
  // The sprite sheet loader: ("flash_export/name", scale, flag) is name.png and name.js;
  // ("flash_export/name", count) is count frames, name/frame0001.jpg ...
  const decoded = all.replace(new RegExp(`\\$[${ID}]+`, 'g'), (t) => (strings.has(t) ? JSON.stringify(strings.get(t)) : t));
  for (const m of decoded.matchAll(/\(["`](flash_export\/[\w-]+)["`],(\d+)(,[^)]{1,6})?\)/g)) {
    out.add(`${m[1]}.png`);
    out.add(`${m[1]}.js`);
    if (!m[3]) for (let i = 1; i <= Number(m[2]) && i <= 999; i++) out.add(`${m[1]}/frame${pad4(i)}.jpg`);
  }
  // Sounds whose .ogg replaces the .mp3: sound_ogg_override.add("id").
  for (const m of decoded.matchAll(/sound_ogg_override\.add\(["`]([\w-]+)["`]\)/g)) out.add(`audio_overrides/${m[1]}.ogg`);
  // The lists, when they are in texts.
  const text = (rel) => (texts.find(([r]) => r === rel) || [])[1];
  const sounds = text(SOUNDS_LIST);
  if (sounds) {
    for (const m of sounds.matchAll(new RegExp(`src:\\s*(\\$[${ID}]+|"[^"]+"|\`[^\`]+\`)`, 'g'))) {
      const v = valueOf(m[1]);
      if (v) out.add(`flash_export/${v}`);
    }
  }
  const skins = text(SKINS_LIST);
  if (skins) { try { for (const id of JSON.parse(skins)) out.add(`flash_export/flash_skins/${id}.png`); } catch {} }
  const campaign = text(CAMPAIGN_LIST);
  if (campaign) {
    try {
      for (const level of JSON.parse(campaign).levels || []) for (const lang of languages) out.add(`gamelogic/campaign/${lang}/${level}.xml`);
    } catch {}
  }
  for (const k of kept) if (k && !k.startsWith('#')) out.add(k.trim());
  return [...out].filter((p) => p && !/^(\.\.|\/)/.test(p));
}

async function pool(items, jobs, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) { const i = next++; await fn(items[i], i); }
  }));
}

// client: CLIENTS.sadburst. Returns { out, version, files, bytes, problems }.
async function fetchSadburst(client, { out = client.gameDir, jobs = 8 } = {}) {
  const base = client.site + client.gamePrefix(null);
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

  // 4, 5. What the game loads: the lists first, then everything they and the code name.
  const manifest = JSON.parse(manifestData.toString('utf8'));
  await pool([SOUNDS_LIST, SKINS_LIST, CAMPAIGN_LIST], jobs, (f) => download(f));
  const textOf = (rel) => { const d = saved.get(rel); return d ? d.toString('utf8') : null; };
  const texts = [...saved.keys()].filter((r) => /\.(js|css|html|json)$/.test(r) && saved.get(r)).map((r) => [r, textOf(r)]);
  let kept = [];
  try { kept = fs.readFileSync(path.join(out, KEPT), 'utf8').split(/\r?\n/); } catch {}
  const assets = assetPaths({
    texts,
    strings: loadStrings(textOf(manifest.strings.en) || ''),
    languages: Object.keys(manifest.strings),
    kept,
  });
  const before = saved.size;
  let done = 0;
  await pool(assets, jobs, async (f) => {
    await download(f);
    if (++done % 200 === 0) console.log(`  assets: ${done} of ${assets.length} looked up, ${(bytes / 1048576).toFixed(1)} MB`);
  });
  console.log(`  assets: ${saved.size - before} files from ${assets.length} paths the game names (${kept.filter(Boolean).length} from ${KEPT})`);
  if (kept.length) fs.writeFileSync(path.join(tmp, KEPT), kept.filter(Boolean).join('\n') + '\n');

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
  console.log(`Anything the game still asks for is fetched once while you play and listed in ${KEPT}, so the next fetch gets it too.`);
  return { out, version, files: saved.size, bytes, problems };
}

module.exports = { fetchSadburst, htmlRefs, moduleRefs, manifestFiles, assetPaths, loadStrings, MANIFEST, VERSION_FILE, KEPT };
