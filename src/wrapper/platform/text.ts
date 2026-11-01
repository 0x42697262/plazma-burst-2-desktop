export const TEXT = Object.freeze({
  expectedObject: 'expected a JSON object',
});

export const INDEX_TEXT = Object.freeze({
  devNotInjected: 'Dev console: could not inject into index.html',
  joinNotPrepared: 'Private server: could not prepare index.html (no <script> tag); not serving it',
  hostNotPrepared: 'Dedicated host: could not prepare index.html (no <script> tag or no scripts/flash.js); not serving it',
  traceSilent: 'Verbose: scripts/flash.js not found in index.html; the game\'s trace() stays silent',
});

export const FILES_TEXT = Object.freeze({
  notFound: 'Not found',
  notFoundBecause: (message: string) => `Not found (${message})`,
  forbidden: 'Forbidden',
  notAvailable: 'Not available',
  invalidJson: 'Invalid JSON',
  expectedObject: 'Expected a JSON object',
  editedElsewhere: 'dev-overrides.json was edited; the console reloads it instead',
  kept: (file: string, bytes: number) => `[sadburst] kept ${file} (${bytes} bytes)`,
  notKept: (file: string, message: string) => `Sad Burst 2: could not keep ${file}: ${message}`,
  newerBuild: (live: string, local: string) => `Sad Burst 2: the site has build ${live}, game.sadburst/ is ${local}. Run "npm run fetch-game -- --sadburst".`,
  namesMissing: (file: string, findNames: string) => `Dev console: ${file} is missing. Run "${findNames}".`,
  namesOtherVersion: (namesVersion: string, gameVersion: string, findNames: string) => `Dev console: names.js is for game ${namesVersion} but the game is ${gameVersion}. Run "${findNames}".`,
  namesIncomplete: 'Dev console: names.js has names that were not found; some commands will fail.',
  consoleBundleMissing: 'Dev console: dist/console/ is missing. Run "npm run build".',
  findNames: (runFlag: string) => `npm run find-names${runFlag}`,
});

export const PAGE_TEXT = Object.freeze({
  tag: (who: string) => (who ? ` ${who}` : ''),
  source: (sourceId: string, line: number) => ` (${sourceId.split('/').pop() ?? ''}:${line})`,
  message: (tag: string, level: string, message: string, source: string) => `[page${tag}:${level}] ${message}${source}`,
  failedLoad: (tag: string, url: string, description: string, code: number) => `[window${tag}] failed to load ${url}: ${description} (${code})`,
  processGone: (tag: string, reason: string, exitCode: number) => `[window${tag}] the page's process is gone: ${reason} (exit code ${exitCode})`,
  unresponsive: (tag: string) => `[window${tag}] the page stopped responding`,
  responsive: (tag: string) => `[window${tag}] the page responds again`,
  navigated: (tag: string, url: string) => `[window${tag}] navigated to ${url}`,
  loaded: (tag: string) => `[window${tag}] page loaded`,
  request: (name: string, method: string, url: string, status: number, milliseconds: number) => `[net]${name ? ` [${name}]` : ''} ${method} ${url} -> ${status} (${milliseconds} ms)`,
});
