#!/usr/bin/env node
'use strict';

/*
 * save_map.js -- download a Plazma Burst 2 map by id and save its XML source.
 *
 * The game asks server.php for a map, gets back a compressed string, and
 * expands it client-side before parsing. This tool does the same two steps
 * from the terminal so a map can be archived without running the game.
 *
 * Expanding needs the substitution table the server encoded with. There are
 * two ways to get it, and by default the tool uses whichever is available:
 *
 *   game     read it out of the newest archived client under game/. Follows
 *            the server if the table ever changes, but needs those files,
 *            which are gitignored and so absent from a fresh clone.
 *   builtin  the copy embedded below. Always available, but frozen.
 *
 * Usage: node scripts/save_map.js <map-id> [<map-id> ...]
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SERVER_URL = 'https://www.plazmaburst2.com/pb2/server.php';

const NOT_PUBLISHED = '<not_published />';

/*
 * Maps whose data starts with this marker are compressed; anything else is
 * already plain XML and passes through untouched. When the table is read from
 * a client the marker is taken from it rather than assumed.
 */
const EMBEDDED_MARKER = '<q.';

/*
 * Substitution table, in the order the game builds it. Each entry is
 * [token, expansion]. Expanding walks the table backwards so that the
 * "<q." header goes first and the "[^]" escape for a literal "^" goes last,
 * after every token that could have produced one has been expanded.
 *
 * Extracted from scripts/libs/xml.js of client v1769098419.
 */
const EMBEDDED_TABLE = [
	["[^]", "^"],
	["^0", "\" /><player x=\""],
	["^1", "\" /><enemy x=\""],
	["^2", "\" /><door x=\""],
	["^3", "\" /><box x=\""],
	["^4", "\" /><gun x=\""],
	["^5", "\" /><pushf x=\""],
	["^6", "\" /><decor x=\""],
	["^7", "\" /><trigger enabled=\"true"],
	["^8", "\" /><trigger enabled=\"false"],
	["^9", "\" /><timer enabled=\"true"],
	["^a", "\" /><timer enabled=\"false"],
	["^b", "\" /><inf mark=\""],
	["^c", " /><bg x=\""],
	["^d", " /><lamp x=\""],
	["^e", " /><region x=\""],
	["^f", "<player x=\""],
	["^g", "\" damage=\""],
	["^h", "\" maxspeed=\""],
	["^i", "\" model=\"gun_"],
	["^j", "\" model=\""],
	["^k", "\" botaction=\""],
	["^l", "\" ondeath=\""],
	["^m", "\" actions_"],
	["^n", "_targetB=\""],
	["^o", "_type=\""],
	["^p", "_targetA=\""],
	["^q", "\" team=\""],
	["^r", "\" side=\""],
	["^s", "\" command=\""],
	["^t", "\" flare=\""],
	["^u", "\" power=\""],
	["^w", "\" moving=\"true"],
	["^x", "\" moving=\"false"],
	["^y", "\" tarx=\""],
	["^z", "\" tary=\""],
	["^A", "\" tox=\""],
	["^B", "\" toy=\""],
	["^C", "\" hea=\""],
	["^D", "\" hmax=\""],
	["^E", "\" incar=\""],
	["^F", "\" char=\""],
	["^G", "\" maxcalls=\""],
	["^H", "\" vis=\"false"],
	["^I", "\" vis=\"true"],
	["^J", "\" use_on=\""],
	["^K", "\" use_target=\""],
	["^L", "\" upg=\"0^"],
	["^M", "\" upg=\""],
	["^N", "^fgun_"],
	["^O", "\" addx=\""],
	["^P", "\" addy=\""],
	["^Q", "\" y=\""],
	["^R", "\" w=\""],
	["^S", "\" h=\""],
	["^T", "\" m=\""],
	["^U", "\" at=\""],
	["^W", "\" delay=\""],
	["^X", "\" target=\""],
	["^Y", "\" stab=\""],
	["^Z", "\" mark=\""],
	["^_", "0^T0^3"],
	["^(", "0^x^y0^z0^h1^"],
	["^)", "^m3^o-1^m3^p0^m3^n0^m4^o-1^m4^p0^m4^n0^m5^o-1^m5^p0^m5^n0^m6^o-1^m6^p0^m6^n0^m7^o-1^m7^p0^m7^n0^m8^o-1^m8^p0^m8^n0^m9^o-1^m9^p0^m9^n0^m10^o-1^m10^p0^m10^n0"],
	["^$", "^m5^o-1^m5^p0^m5^n0^m6^o-1^m6^p0^m6^n0^m7^o-1^m7^p0^m7^n0^m8^o-1^m8^p0^m8^n0^m9^o-1^m9^p0^m9^n0^m10^o-1^m10^p0^m10^n0"],
	["^@", "^A0^B0^C130^D130^q"],
	["^~", "0^u0.4^t1\"^"],
	["^!", "0^Q1"],
	["^.", "0^R"],
	["^,", "0^S"],
	["^*", "0^Q-"],
	["^-", "0^Q"],
	["^+", "\" /><water x=\""],
	["^;", "\" forteam=\""],
	["^:", "^Ttrue"],
	["^?", "true"],
	["^<", "false"],
	["^>", "^m2^o-1^m2^p0^m2^n0^)"],
	["^/", "pistol"],
	["^#", "rifle"],
	["^%", "shotgun"],
	["^&", "real_"],
	["<q.", ""]
];

/* ---------------------------------------------------------------- table */

/*
 * Locate archived clients. Rather than pin a version directory, look for any
 * directory under game/ holding both _strings.js and scripts/libs/xml.js --
 * that pair is what the table is built from. Newest first, where "newest" is
 * the trailing number in the directory name (v1769098419 and friends).
 */
function findClients(gameRoot, maxDepth = 6) {
	const found = [];

	const walk = (dir, depth) => {
		if (depth > maxDepth) return;

		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch (e) {
			return;
		}

		if (fs.existsSync(path.join(dir, '_strings.js')) &&
			fs.existsSync(path.join(dir, 'scripts', 'libs', 'xml.js')))
			found.push(dir);

		for (const entry of entries)
			if (entry.isDirectory())
				walk(path.join(dir, entry.name), depth + 1);
	};

	walk(gameRoot, 0);

	const version = (dir) => {
		const match = /(\d+)\D*$/.exec(path.basename(dir));
		return match ? Number(match[1]) : -1;
	};

	return found.sort((a, b) => version(b) - version(a) || b.localeCompare(a));
}

/*
 * Pull the table out of a client without relying on any obfuscated name: run
 * the two files in a throwaway context, then look for the one array holding
 * nothing but pairs of strings. Identifiers are regenerated per build, but
 * that shape is what the expander actually consumes.
 */
function tableFromClient(dir) {
	const context = vm.createContext({});

	for (const file of ['_strings.js', path.join('scripts', 'libs', 'xml.js')]) {
		const code = fs.readFileSync(path.join(dir, file), 'utf8');
		vm.runInContext(code, context, { filename: file, timeout: 10000 });
	}

	const isPairArray = (value) =>
		Array.isArray(value) &&
		value.length >= 8 &&
		value.every((pair) =>
			Array.isArray(pair) && pair.length === 2 &&
			typeof pair[0] === 'string' && typeof pair[1] === 'string');

	const candidates = Object.values(context).filter(isPairArray);

	if (candidates.length === 0)
		throw new Error('no substitution table found');
	if (candidates.length > 1)
		throw new Error('found ' + candidates.length + ' possible substitution tables');

	const raw = candidates[0];

	/*
	 * The client stores each entry as [expansion, token]. Rather than trust
	 * that order, pick the token column by length: tokens are a couple of
	 * characters, the text they stand in for is much longer.
	 */
	const mean = (i) => raw.reduce((sum, pair) => sum + pair[i].length, 0) / raw.length;
	const tokenFirst = mean(0) < mean(1);

	const table = raw.map((pair) => tokenFirst ? [pair[0], pair[1]] : [pair[1], pair[0]]);

	/* The entry that expands to nothing is the header stripped off the front. */
	const markers = table.filter((pair) => pair[1] === '').map((pair) => pair[0]);
	if (markers.length !== 1)
		throw new Error('expected exactly one header marker, found ' + markers.length);

	return { table, marker: markers[0] };
}

function resolveTable(options) {
	const builtin = {
		table: EMBEDDED_TABLE,
		marker: EMBEDDED_MARKER,
		source: 'builtin'
	};

	if (options.table === 'builtin')
		return builtin;

	const clients = findClients(options.gameDir);
	const problems = [];

	for (const dir of clients) {
		try {
			const found = tableFromClient(dir);
			found.source = path.relative(options.repoRoot, dir) || dir;

			if (JSON.stringify(found.table) !== JSON.stringify(EMBEDDED_TABLE))
				process.stderr.write('save_map: note: ' + found.source +
					' has a different table than the embedded copy (' +
					found.table.length + ' vs ' + EMBEDDED_TABLE.length + ' entries)\n');

			return found;
		} catch (e) {
			problems.push(path.relative(options.repoRoot, dir) + ': ' + e.message);
		}
	}

	if (options.table === 'game') {
		const detail = clients.length === 0
			? 'no client found under ' + options.gameDir
			: problems.join('; ');
		throw new Error('cannot read table from a client (' + detail + ')');
	}

	for (const problem of problems)
		process.stderr.write('save_map: ' + problem + '\n');

	return builtin;
}

/* --------------------------------------------------------------- decode */

function expand(str, table) {
	for (let i = table.length - 1; i >= 0; i--) {
		str = str.split(table[i][0]).join(table[i][1]);
	}
	return str;
}

/*
 * The expanded map is one long line. The archived maps put each element on
 * its own line, which is the only difference between the two.
 */
function format(xml) {
	return xml.split('/><').join('/>\n<') + '\n';
}

/* ---------------------------------------------------------------- fetch */

async function fetchMap(id, login, password) {
	const body = new URLSearchParams({
		l: login,
		p: password,
		rq: 'cmap',
		cmap: id,
		qpack: '1.0'
	});

	const response = await fetch(SERVER_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});

	if (!response.ok)
		throw new Error('server returned HTTP ' + response.status + ' ' + response.statusText);

	/*
	 * Maps are handled as bytes throughout: latin1 round-trips any byte
	 * sequence unchanged, and every token in the table is ASCII, so the
	 * output is byte-identical to what the game received.
	 */
	const data = Buffer.from(await response.arrayBuffer()).toString('latin1');

	if (data.trim() === NOT_PUBLISHED)
		throw new Error('map is not published (or the id does not exist)');

	if (data.length === 0)
		throw new Error('server returned an empty response');

	return data;
}

/* ---------------------------------------------------------------- batch */

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * One map id per line. Blank lines and lines starting with # are ignored, so
 * the file can carry comments and stay readable at 300k lines.
 */
function readIdsFromFile(file) {
	const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
	const ids = [];
	for (const line of lines) {
		const id = line.trim();
		if (id.length > 0 && !id.startsWith('#'))
			ids.push(id);
	}
	return ids;
}

/*
 * Progress is keyed to a specific --input file and its id count: as long as
 * both match, "index" is trusted as where the last run left off. Anything
 * else (missing file, different input, different length) just means start
 * the scan from the top again -- already-downloaded maps still get skipped
 * individually via the on-disk check in downloadBatch, so nothing is
 * redownloaded even if the state file is stale or gone.
 */
function loadState(options, total) {
	if (!options.state || !fs.existsSync(options.state))
		return { index: 0 };

	try {
		const saved = JSON.parse(fs.readFileSync(options.state, 'utf8'));
		if (saved.input === options.input && saved.total === total &&
			Number.isInteger(saved.index) && saved.index >= 0 && saved.index <= total)
			return { index: saved.index };

		process.stderr.write('save_map: ' + options.state +
			' is for a different --input list; starting the scan over ' +
			'(existing maps will still be skipped, not redownloaded)\n');
	} catch (e) {
		process.stderr.write('save_map: could not read ' + options.state + ': ' + e.message + '\n');
	}
	return { index: 0 };
}

function saveState(options, total, index) {
	if (!options.state)
		return;
	const payload = { input: options.input, total: total, index: index };
	fs.writeFileSync(options.state, JSON.stringify(payload));
}

/* ------------------------------------------------------------------ cli */

function usage() {
	console.log(`Usage: node scripts/save_map.js [options] <map-id> [<map-id> ...]
       node scripts/save_map.js [options] --input ids.txt

Downloads a Plazma Burst 2 map and writes its XML source to <out-dir>/<map-id>.xml.
A map id is what the game's "Custom Map" field takes, e.g. wanted2001-saw.

Maps can be listed on the command line, or (for large batches) one per line in
a file passed with --input; blank lines and lines starting with # are ignored.
Downloading pauses between requests (see --delay/--jitter) to stay well under
any server rate limit, and resumes where it left off: a map already saved in
<out-dir> is skipped, and a small state file tracks which line of --input to
resume from next time, so stopping (Ctrl-C included) and rerunning the same
command is always safe.

Options:
  -o, --out <dir>       output directory (default: maps)
  -i, --input <file>    file with one map id per line, for large batches
  -l, --login <name>    account login (default: .guest)
  -p, --password <pw>   account password (default: .guest)
  -t, --table <where>   substitution table to expand with:
                          auto     newest archived client, else embedded (default)
                          game     newest archived client, fail if unusable
                          builtin  the embedded copy
      --game-dir <dir>  where to look for archived clients (default: <repo>/game)
  -r, --raw             save the compressed response as received, without expanding
      --no-format       keep the expanded XML on a single line
      --stdout          write to stdout instead of a file
      --delay <ms>      minimum pause between server requests (default: 1500)
      --jitter <ms>     extra random pause added to --delay, 0..<ms> (default: 750)
      --limit <n>       stop after downloading at most <n> maps this run
  -f, --force           redownload even if <out-dir>/<map-id>.xml already exists
      --state <file>    progress file for --input (default: <out-dir>/.save_map-progress.json)
  -v, --verbose         report which table was used
  -h, --help            show this message`);
}

function parseArgs(argv, repoRoot) {
	const options = {
		ids: [],
		input: null,
		out: 'maps',
		login: '.guest',
		password: '.guest',
		table: 'auto',
		repoRoot: repoRoot,
		gameDir: path.join(repoRoot, 'game'),
		raw: false,
		format: true,
		stdout: false,
		delay: 1500,
		jitter: 750,
		limit: Infinity,
		force: false,
		state: null,
		verbose: false
	};

	let gameDirSet = false;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => {
			if (i + 1 >= argv.length)
				throw new Error('missing value for ' + arg);
			return argv[++i];
		};
		const nextNumber = () => {
			const value = Number(next());
			if (!Number.isFinite(value) || value < 0)
				throw new Error('bad numeric value for ' + arg);
			return value;
		};

		switch (arg) {
			case '-o': case '--out': options.out = next(); break;
			case '-i': case '--input': options.input = next(); break;
			case '-l': case '--login': options.login = next(); break;
			case '-p': case '--password': options.password = next(); break;
			case '-t': case '--table': options.table = next(); break;
			case '--game-dir': options.gameDir = next(); gameDirSet = true; break;
			case '-r': case '--raw': options.raw = true; break;
			case '--no-format': options.format = false; break;
			case '--stdout': options.stdout = true; break;
			case '--delay': options.delay = nextNumber(); break;
			case '--jitter': options.jitter = nextNumber(); break;
			case '--limit': options.limit = nextNumber(); break;
			case '-f': case '--force': options.force = true; break;
			case '--state': options.state = next(); break;
			case '-v': case '--verbose': options.verbose = true; break;
			case '-h': case '--help': usage(); process.exit(0);
			default:
				if (arg.startsWith('-'))
					throw new Error('unknown option ' + arg);
				options.ids.push(arg);
		}
	}

	if (!['auto', 'game', 'builtin'].includes(options.table))
		throw new Error('--table must be auto, game or builtin');

	if (gameDirSet)
		options.gameDir = path.resolve(options.gameDir);

	if (options.input) {
		options.input = path.resolve(options.input);
		if (!options.state)
			options.state = path.join(options.out, '.save_map-progress.json');
	}

	if (options.stdout && options.input)
		throw new Error('--stdout cannot be combined with --input');

	if (options.ids.length === 0 && !options.input)
		throw new Error('no map id given (pass ids directly or use --input)');

	return options;
}

async function main() {
	let options;
	try {
		options = parseArgs(process.argv.slice(2), path.resolve(__dirname, '..'));
	} catch (e) {
		console.error('save_map: ' + e.message);
		usage();
		process.exit(2);
	}

	let expander;
	try {
		expander = resolveTable(options);
	} catch (e) {
		console.error('save_map: ' + e.message);
		process.exit(2);
	}

	if (options.verbose)
		console.error('save_map: table from ' + expander.source +
			' (' + expander.table.length + ' entries, marker ' +
			JSON.stringify(expander.marker) + ')');

	if (!options.stdout)
		fs.mkdirSync(options.out, { recursive: true });

	const fileIds = options.input ? readIdsFromFile(options.input) : [];
	const ids = options.input ? fileIds.concat(options.ids) : options.ids;
	const total = ids.length;

	const state = loadState(options, total);
	let index = state.index;

	if (index > 0 && index < total)
		console.error('save_map: resuming ' + options.state + ' at ' +
			(index + 1) + '/' + total);
	else if (index > 0)
		console.error('save_map: ' + options.state + ' says this input is already fully processed');

	let downloaded = 0, skipped = 0, failures = 0;
	let stopping = false;

	const report = (reason) => {
		const remaining = total - index;
		const resumeHint = remaining > 0 && options.state ? '; resume with the same command' : '';
		console.error('save_map: ' + reason + ' -- ' + index + '/' + total +
			' processed (' + downloaded + ' downloaded, ' + skipped + ' skipped, ' +
			failures + ' failed), ' + remaining + ' map' + (remaining === 1 ? '' : 's') +
			' left' + resumeHint);
	};

	const onSignal = (signal) => {
		stopping = true;
		saveState(options, total, index);
		report('stopped (' + signal + ')');
		process.exit(130);
	};
	process.on('SIGINT', onSignal);
	process.on('SIGTERM', onSignal);

	for (; index < total && !stopping; index++) {
		if (downloaded >= options.limit) {
			saveState(options, total, index);
			report('stopping, --limit ' + options.limit + ' reached');
			process.removeListener('SIGINT', onSignal);
			process.removeListener('SIGTERM', onSignal);
			process.exit(0);
		}

		const id = ids[index];
		const file = options.stdout ? null : path.join(options.out, id + '.xml');

		if (file && !options.force && fs.existsSync(file)) {
			skipped++;
			if (index % 200 === 0)
				saveState(options, total, index);
			continue;
		}

		try {
			const data = await fetchMap(id, options.login, options.password);

			let xml = data;
			if (!options.raw && xml.startsWith(expander.marker)) {
				xml = expand(xml, expander.table);
				if (options.format)
					xml = format(xml);
			}

			if (options.stdout) {
				process.stdout.write(Buffer.from(xml, 'latin1'));
			} else {
				fs.writeFileSync(file, Buffer.from(xml, 'latin1'));
				console.log(file + ' (' + xml.length + ' bytes)');
			}
			downloaded++;
		} catch (e) {
			console.error('save_map: ' + id + ': ' + e.message);
			failures++;
		}

		saveState(options, total, index + 1);

		/*
		 * Only actual requests to the server are throttled -- skipped maps
		 * cost it nothing, so resuming a mostly-complete run doesn't sit
		 * through a delay for every already-downloaded map.
		 */
		if (index + 1 < total)
			await sleep(options.delay + Math.random() * options.jitter);
	}

	process.removeListener('SIGINT', onSignal);
	process.removeListener('SIGTERM', onSignal);

	if (!stopping) {
		saveState(options, total, index);
		report('done');
	}

	process.exit(failures > 0 ? 1 : 0);
}

main();
