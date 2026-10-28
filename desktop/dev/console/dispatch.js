// Running a typed line: split a ";" chain, find each command in the registry, say when
// it is client-only in multiplayer, and run it.
import { print } from './ui/log.js';
import { COLOR } from './core/colors.js';
import { plural, isHelpArg } from './core/text.js';
import { game } from './game/bindings.js';
import { resolveKey, keyClientOnly, unphrase } from './state/schema.js';
import { findRunnable, findSubcommand, reachOf } from './commands/registry.js';
import { printTopicHelp } from './commands/help.js';
import { runKey } from './commands/settings.js';

// How Chrome marks a stack frame from DevTools or eval.
const ANONYMOUS_FRAME = 'at <anonymous>:';

// "a ; b" runs a and then b, in one go: nothing from the game or the network lands
// between them. That is the point: a chat message runs the map's "player says" trigger,
// which overwrites variables like SkinChatVar between a "vars set" and the "vars sync"
// meant to send it. A ";" inside double quotes belongs to the value, and a command that
// takes the rest of the line ("js": JavaScript uses ";" itself) is never split.
export function splitCommands(text) {
  const cmd = findRunnable(text.split(/\s+/)[0]);
  if (cmd && cmd.rawLine) return [text];
  const parts = [];
  let cur = '';
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    if (c === ';' && !quoted) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((part) => part.trim()).filter(Boolean);
}

// The yellow note when a client-only command or key is used in multiplayer.
function noteReach(cmd, word, args) {
  if (!game.isMP() || isHelpArg(args)) return;
  let reach;
  if (!cmd) {
    const key = resolveKey(word);
    const reason = keyClientOnly(key);
    reach = reason && [key, reason];
  } else {
    const sub = findSubcommand(cmd, args[0]);
    if (sub && sub.reportsReach) return;
    reach = reachOf(cmd, args);
  }
  if (reach) print([[`Note: "${reach[0]}" is client-only: ${reach[1]}.`, COLOR.warn, true]]);
}

function dispatch(cmd, word, args, rest) {
  if (!cmd) {
    const key = resolveKey(word);
    if (!key) throw new Error(`unknown command "${word}". Type "help".`);
    runKey(key, args);
    return;
  }
  // "<command> help" is "help <command>", unless the command has its own.
  if (isHelpArg(args) && !cmd.handlesHelp) { printTopicHelp(cmd.name); return; }
  const sub = findSubcommand(cmd, args[0]);
  if (sub) sub.run(args.slice(1), { rest, verb: args[0].toLowerCase() });
  else cmd.run(args, { rest });
}

// One command. Returns false when it failed (its error is already printed).
function runOne(text) {
  const [first, ...args] = text.split(/\s+/);
  const word = first.toLowerCase();
  const rest = text.slice(first.length).trim();
  const cmd = findRunnable(word);
  try { noteReach(cmd, word, args); } catch {}
  try {
    dispatch(cmd, word, args, rest);
    return true;
  } catch (e) {
    print(`error: ${e && e.message}`, COLOR.error);
    return false;
  }
}

// `source` labels a line that was not typed, e.g. "bind f".
export function run(line, source) {
  const text = String(line || '').trim();
  if (!text) return;
  // The game reloads the page if the first call of its stack check ($oITOo in
  // libs/tools.js, reached e.g. from the trigger runner) sees an anonymous frame, which
  // is what code from DevTools or eval has. A line run from such code (pb2dev.run in
  // DevTools, "js pb2dev.run(...)") runs from a clean timer instead.
  if (new Error().stack.includes(ANONYMOUS_FRAME)) { setTimeout(() => run(line, source), 0); return; }
  print(source ? `[${source}] > ${text}` : `> ${text}`, COLOR.title);
  const parts = splitCommands(text);
  for (let i = 0; i < parts.length; i++) {
    if (parts.length > 1) print(`[${i + 1}/${parts.length}] ${parts[i]}`, COLOR.muted);
    if (!runOne(unphrase(parts[i]))) {
      const left = parts.length - 1 - i;
      if (left) print(`Stopped: ${plural(left, 'command')} after this one did not run.`, COLOR.warn);
      return;
    }
  }
}
