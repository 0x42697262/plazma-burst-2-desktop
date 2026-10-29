#!/usr/bin/env node
// Downloads a complete copy of the Plazma Burst 2 HTML5 game into game/.
//
// The official server publishes each version under /h5/versions/v<number>/ and has
// directory listings enabled for its sub-folders, so every file can be found:
//   1. index.html and everything it references (scripts, CSS, _strings.js)
//   2. folders mentioned in the code (scripts/, flash_export/, fonts/, ...), crawled
//      recursively through their directory listings
//
// Usage: node tools/fetch-game.js [version] [--out dir] [--no-names] [--jobs n]
//   version     e.g. v1769098419 (default: the version linked from /h5/)
//   --out       target folder (default: game/). The old copy is kept as <out>.previous
//   --no-names  do not run tools/find-names.js and tools/fetch-opcodes.js afterwards
//   --jobs      parallel downloads (default 8)
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = 'https://www.plazmaburst2.com';
const REPO = path.join(__dirname, '..');
const UA = 'Mozilla/5.0 (pb2-desktop fetch-game)';
const TEXT_EXT = new Set(['.html', '.htm', '.js', '.css', '.json', '.txt', '.xml']);

function parseArgs(argv) {
  const opts = { out: path.join(REPO, 'game'), names: true, jobs: 8, version: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = path.resolve(argv[++i]);
    else if (a === '--no-names') opts.names = false;
    else if (a === '--jobs') opts.jobs = Math.max(1, Number(argv[++i]) || 8);
    else if (a === '-h' || a === '--help') {
      console.log('Usage: node tools/fetch-game.js [version] [--out dir] [--no-names] [--jobs n]');
      process.exit(0);
    } else if (/^v?\d+$/.test(a)) opts.version = a.startsWith('v') ? a : 'v' + a;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET with retries. Missing files answer with a redirect, so redirects count as "not found".
async function get(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA } });
      if (res.status === 200) return Buffer.from(await res.arrayBuffer());
      if (res.status >= 300 && res.status < 500) return null;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (attempt >= tries) throw new Error(`${url}: ${e.message}`);
      await sleep(500 * 2 ** attempt);
    }
  }
}

async function latestVersion() {
  const html = (await get(`${SITE}/h5/`))?.toString('utf8') || '';
  const m = html.match(/versions\/(v\d+)\//);
  if (!m) throw new Error(`Could not find the current version on ${SITE}/h5/. Pass it as an argument.`);
  return m[1];
}

// Relative references in HTML/CSS: src="", href="", url().
function htmlRefs(text) {
  const refs = [];
  for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)/gi)) refs.push(m[1]);
  for (const m of text.matchAll(/url\(\s*["']?([^"')?#]+)/gi)) refs.push(m[1]);
  return refs.filter((r) => !/^([a-z]+:|\/|data:)/i.test(r));
}

// Top-level folder names mentioned in code, e.g. 'flash_export/skins' -> flash_export.
function folderCandidates(text) {
  const out = new Set();
  for (const m of text.matchAll(/["'`(]\.{0,2}\/?([A-Za-z_][\w-]{1,40})\/[\w./-]*/g)) out.add(m[1]);
  return out;
}

// Directory listing ("Index of ...") -> { files: [...], dirs: [...] } (names, no slashes).
function parseListing(html) {
  if (!/<title>Index of /i.test(html)) return null;
  const files = [];
  const dirs = [];
  for (const m of html.matchAll(/<a href="([^"?]+)"/g)) {
    const href = decodeURIComponent(m[1]);
    if (href.startsWith('/') || href.startsWith('?') || href.includes('://') || href === '../') continue;
    if (href.endsWith('/')) dirs.push(href.slice(0, -1));
    else files.push(href);
  }
  return { files, dirs };
}

async function pool(items, jobs, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const version = opts.version || (await latestVersion());
  const base = `${SITE}/h5/versions/${version}/`;
  const tmp = `${opts.out}.download`;
  console.log(`Game version ${version}\nSource ${base}\nTarget ${opts.out}`);

  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const saved = new Map(); // relative path -> size
  const missing = new Set();
  const texts = []; // [relPath, text] of downloaded text files
  let bytes = 0;

  async function download(rel) {
    rel = path.posix.normalize(rel).replace(/^\.\//, '');
    if (rel.startsWith('..') || saved.has(rel) || missing.has(rel)) return;
    saved.set(rel, 0);
    const data = await get(base + rel.split('/').map(encodeURIComponent).join('/'));
    if (!data) { saved.delete(rel); missing.add(rel); return; }
    const file = path.join(tmp, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    saved.set(rel, data.length);
    bytes += data.length;
    if (saved.size % 50 === 0) console.log(`  ${saved.size} files, ${(bytes / 1048576).toFixed(1)} MB`);
    if (TEXT_EXT.has(path.extname(rel).toLowerCase())) texts.push([rel, data.toString('utf8')]);
  }

  // 1. index.html and its direct references (root folder has no listing).
  await download('index.html');
  if (!saved.has('index.html')) throw new Error(`${base}index.html not found. Is "${version}" a valid version?`);
  const indexRefs = htmlRefs(texts[0][1]);
  await pool(indexRefs, opts.jobs, (r) => download(r));
  for (const [rel, text] of texts.slice()) {
    if (rel.endsWith('.css')) {
      const dir = path.posix.dirname(rel);
      await pool(htmlRefs(text), opts.jobs, (r) => download(path.posix.join(dir, r)));
    }
  }

  // 2. Crawl every folder that is referenced or mentioned in the code.
  const probed = new Set();
  const crawlQueue = [];
  async function crawl(dir) {
    const html = (await get(base + dir + '/'))?.toString('utf8');
    const listing = html && parseListing(html);
    if (!listing) return false;
    await pool(listing.files, opts.jobs, (f) => download(`${dir}/${f}`));
    for (const d of listing.dirs) await crawl(`${dir}/${d}`);
    return true;
  }
  let scanned = 0;
  for (;;) {
    for (const r of indexRefs) if (r.includes('/')) crawlQueue.push(r.split('/')[0]);
    for (; scanned < texts.length; scanned++) for (const d of folderCandidates(texts[scanned][1])) crawlQueue.push(d);
    const todo = [...new Set(crawlQueue)].filter((d) => !probed.has(d));
    crawlQueue.length = 0;
    if (!todo.length) break;
    for (const d of todo) {
      probed.add(d);
      if (await crawl(d)) console.log(`  crawled ${d}/`);
    }
  }

  // 3. Sanity checks.
  const problems = [];
  for (const r of indexRefs) if (missing.has(path.posix.normalize(r))) problems.push(`index.html references missing ${r}`);
  for (const need of ['_strings.js', 'scripts/frame2.js', 'scripts/main.js']) {
    if (!saved.has(need)) problems.push(`required file missing: ${need}`);
  }
  const manifest = texts.find(([rel]) => rel === 'flash_export/just_sounds_and_bitmaps.html');
  if (manifest) {
    for (const m of manifest[1].matchAll(/src:\s*"([^"]+)"/g)) {
      const rel = path.posix.join('flash_export', m[1]);
      if (!saved.has(rel) && !rel.includes('/sounds/')) problems.push(`sprite/sound manifest lists missing ${rel}`);
    }
  } else {
    problems.push('flash_export/just_sounds_and_bitmaps.html (asset manifest) not found');
  }
  if (problems.length) {
    console.log('Problems:');
    for (const p of problems) console.log(`  ${p}`);
  }

  fs.writeFileSync(path.join(tmp, 'pb2-version.json'), JSON.stringify({
    version,
    source: base,
    fetched: new Date().toISOString(),
    files: saved.size,
    bytes,
  }, null, 2) + '\n');

  // 4. Swap in the new copy; keep the old one as <out>.previous.
  const prev = `${opts.out}.previous`;
  if (fs.existsSync(opts.out)) {
    fs.rmSync(prev, { recursive: true, force: true });
    fs.renameSync(opts.out, prev);
    console.log(`Old copy moved to ${path.basename(prev)}/`);
  }
  fs.renameSync(tmp, opts.out);
  console.log(`Done: ${saved.size} files, ${(bytes / 1048576).toFixed(1)} MB in ${opts.out}`);

  if (opts.names) {
    console.log('\nFinding obfuscated names for the dev console...');
    const r = require('./find-names').run({ gameDir: opts.out });
    if (r.missing.length || r.problems.length) {
      console.log('Some names were not found. The dev console may not fully work; see README.md, "Finding the obfuscated names".');
      process.exitCode = 1;
    }
    console.log('\nFetching the map editor\'s trigger action names...');
    try {
      execFileSync(process.execPath, [path.join(__dirname, 'fetch-opcodes.js')], { stdio: 'inherit' });
    } catch {
      console.log('Not updated: "triggers exec" only knows actions written as op<number>. Run "npm run fetch-opcodes" later.');
    }
  }
  if (problems.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`fetch-game failed: ${e.message}`);
  process.exit(2);
});
