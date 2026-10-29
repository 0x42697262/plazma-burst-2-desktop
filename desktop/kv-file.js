// desktop/dev-overrides.json, shared by the dev console and you. The console reads it at
// start and writes it on every change; you may edit it while the game runs. So:
// - an edit is handed to the console (onChange with the parsed object), which takes it;
// - a file that is not valid JSON is reported (onError) and the console's copy stays;
// - the console never writes over a file that changed since it last saw it (your edit,
//   or one it is still waiting to load, or a broken one): it gets the file instead.
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

const WATCH_DELAY_MS = 200; // an editor's save can be several writes; wait for the last

function createKvFile(file, { onChange, onError, watchDelayMs = WATCH_DELAY_MS }) {
  let known = null; // the text the console last wrote or read
  let broken = null; // the unreadable text already reported
  let timer = null;
  const readText = () => fs.readFile(file, 'utf8').catch(() => null);

  // The file as it is now, when it is news to the console.
  async function check() {
    const text = await readText();
    if (text === null || text === known || text === broken) return;
    let obj;
    try {
      obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('expected a JSON object');
    } catch (e) {
      broken = text; // `known` stays the old text, so writes wait until the file is fixed
      onError(e.message);
      return;
    }
    known = text;
    broken = null;
    onChange(obj);
  }

  return {
    // For the console's start: the text, '{}' when there is no file.
    async read() {
      const text = await readText();
      if (text === null) return '{}';
      known = text;
      return text;
    },
    // Returns false (and hands the file to the console) when it changed on disk.
    async write(obj) {
      const disk = await readText();
      if (known !== null && disk !== null && disk !== known) {
        await check();
        return false;
      }
      known = JSON.stringify(obj, null, 2) + '\n';
      await fs.writeFile(file, known);
      return true;
    },
    check,
    // Watches the folder, not the file, so an editor that saves by replacing it is seen too.
    watch() {
      const watcher = fsSync.watch(path.dirname(file), (event, name) => {
        if (name !== path.basename(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => { check().catch(() => {}); }, watchDelayMs);
      });
      return () => { clearTimeout(timer); watcher.close(); };
    },
  };
}

module.exports = { createKvFile };
