// Map text, shared by the desktop wrapper (desktop/main.js) and the server (server/):
// the site sends a map in a compressed "<q." format, unpacked here with the game's own
// function from scripts/libs/xml.js, run in a sandbox; and a map is kept one tag per
// line so the files are readable and diff cleanly.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const COMPRESSED = require('./dev/console/shared.json').map.compressedPrefix;
const NOT_PUBLISHED = require('./dev/console/shared.json').map.notPublished;

const isCompressed = (text) => String(text).startsWith(COMPRESSED);

// A function(text) -> plain map XML, using the game files in gameDir. Plain text passes
// through. The game's function is looked up on first use.
function makeUnpacker(gameDir) {
  let unpack = null;
  return (text) => {
    if (!isCompressed(text)) return text;
    if (!unpack) {
      const ctx = {};
      ctx.globalThis = ctx;
      vm.createContext(ctx);
      vm.runInContext(fs.readFileSync(path.join(gameDir, '_strings.js'), 'utf8'), ctx);
      const src = fs.readFileSync(path.join(gameDir, 'scripts', 'libs', 'xml.js'), 'utf8');
      vm.runInContext(src, ctx);
      const m = src.match(/function (\$[^\s(]+)\(str\)\s*\{\s*for\(i=/);
      if (!m) throw new Error('map decompressor not found in scripts/libs/xml.js');
      unpack = vm.runInContext(m[1], ctx);
    }
    const out = unpack(text);
    if (isCompressed(out)) throw new Error('map is still compressed after unpacking');
    return out;
  };
}

// The site sends a map as one long line of self-closing tags; this puts one tag per
// line (the game's parser skips whatever sits between tags). Quoted attribute values are
// left alone, brackets inside them too.
function beautifyMap(text) {
  const lines = [];
  let line = '';
  let quoted = false;
  for (const c of text) {
    if (quoted) {
      line += c;
      if (c === '"') quoted = false;
      continue;
    }
    if (c === '<' && line.trim()) {
      lines.push(line.trim());
      line = '';
    }
    line += c;
    if (c === '"') quoted = true;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.length ? lines.join('\n') + '\n' : '';
}

module.exports = { makeUnpacker, beautifyMap, isCompressed, COMPRESSED, NOT_PUBLISHED };
