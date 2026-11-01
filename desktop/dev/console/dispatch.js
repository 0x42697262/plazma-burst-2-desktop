// Running a typed line: split a ";" chain, find each command in the registry, say when
// it is client-only in multiplayer, and run it.
import { print } from '../../../src/console/kernel/ui/log.ts';
import { COLOR } from '../../../src/console/kernel/core/keys.ts';
import { plural, isHelpArg } from '../../../src/console/kernel/core/words.ts';
import { game } from '../../../src/console/kernel/game/bindings.ts';
import { SCHEMA, resolveKey, keyClientOnly, unphrase } from '../../../src/console/kernel/state/schema.ts';
import { findRunnable, findSubcommand, reachOf } from './commands/registry.js';
import { printTopicHelp } from './commands/help.js';
import { runKey } from './commands/settings.js';
import { askingToBypass, answerBypass } from '../../../src/console/kernel/danger/bypass.ts';
import { BYPASSED_LINES, NOT_BYPASSED_LINE } from '../../../src/console/kernel/danger/text.ts';

// How Chrome marks a stack frame from DevTools or eval.
const ANONYMOUS_FRAME = 'at <anonymous>:';

// "a ; b" runs a and then b, in one go: nothing from the game or the network lands
// between them. That is the point: a chat message runs the map's "player says" trigger,
// which overwrites variables like SkinChatVar between a "vars set" and the "vars sync"
// meant to send it. A ";" inside double quotes belongs to the value, and a command that
// takes the rest of the line ("js": JavaScript uses ";" itself, and "triggers exec") is
// never split. Where a key name goes, ";" is the key: "bind ; heal".
// The position of the key-name word in a command: "bind <key>", "unbind <key>", and a
// key setting such as "screenshot_key <key>" (or "set screenshot_key <key>").
function keyArgOf(words) {
  const cmd = findRunnable(words[0]);
  // A subcommand's position counts from the command: "profile bind <name> <key>" is 3.
  const sub = cmd && words.length > 1 && findSubcommand(cmd, words[1]);
  const def = sub && sub.keyArg !== undefined ? sub : cmd;
  if (def) return typeof def.keyArg === 'function' ? def.keyArg(words) : def.keyArg;
  const key = resolveKey(words[0]);
  return key && SCHEMA[key].type === 'key' ? 1 : undefined;
}

// Just before a ";", with only modifiers ("shift+") typed of the word: is that word a key
// name? Then the ";" is the key, not the end of the command.
const MODIFIERS_ONLY = /^((ctrl|control|ctl|alt|option|shift)\+)*$/i;
function atKeyName(cur) {
  const words = cur.trimStart().split(/\s+/);
  const typing = words.pop();
  return words.length > 0 && MODIFIERS_ONLY.test(typing) && keyArgOf(words) === words.length;
}

export function splitCommands(text) {
  const words = text.trim().split(/\s+/);
  const cmd = findRunnable(words[0]);
  if (cmd && (cmd.rawLine || findSubcommand(cmd, words[1])?.rawLine)) return [text];
  const parts = [];
  let cur = '';
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    if (c === ';' && !quoted && !atKeyName(cur)) { parts.push(cur); cur = ''; continue; }
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

// extra: { source, chained }: where the line came from (undefined: typed) and whether it
// is one part of a ";" chain. "bypass checks" uses it to accept only a typed line.
function dispatch(cmd, word, args, rest, extra) {
  if (!cmd) {
    const key = resolveKey(word);
    if (!key) throw new Error(`unknown command "${word}". Type "help".`);
    runKey(key, args);
    return;
  }
  // "<command> help" is "help <command>", unless the command has its own.
  if (isHelpArg(args) && !cmd.handlesHelp) { printTopicHelp(cmd.name); return; }
  const sub = findSubcommand(cmd, args[0]);
  if (sub) sub.run(args.slice(1), { rest, verb: args[0].toLowerCase(), ...extra });
  else cmd.run(args, { rest, ...extra });
}

// One command. Returns false when it failed (its error is already printed).
function runOne(text, extra) {
  const [first, ...args] = text.split(/\s+/);
  const word = first.toLowerCase();
  const rest = text.slice(first.length).trim();
  const cmd = findRunnable(word);
  try { noteReach(cmd, word, args); } catch {}
  try {
    dispatch(cmd, word, args, rest, extra);
    return true;
  } catch (e) {
    print(`error: ${e && e.message}`, COLOR.error);
    return false;
  }
}

// The line as it may be kept and shown: a command's `mask` hides what it must not keep
// (the server password in "servers add ... password=..."), in the history and the log.
export function maskLine(line) {
  const text = String(line || '');
  const cmd = findRunnable(text.trim().split(/\s+/)[0]);
  return cmd && typeof cmd.mask === 'function' ? cmd.mask(text) : text;
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
  print(source ? `[${source}] > ${maskLine(text)}` : `> ${maskLine(text)}`, COLOR.title);
  // The answer to "bypass checks": the next typed line, compared as typed (keys and
  // binds run as usual meanwhile). Any other line is not run.
  if (!source && askingToBypass()) {
    if (answerBypass(text)) for (const l of BYPASSED_LINES) print(l, COLOR.error);
    else print(NOT_BYPASSED_LINE, COLOR.notice);
    return;
  }
  const parts = splitCommands(text);
  for (let i = 0; i < parts.length; i++) {
    if (parts.length > 1) print(`[${i + 1}/${parts.length}] ${parts[i]}`, COLOR.muted);
    if (!runOne(unphrase(parts[i]), { source, chained: parts.length > 1 })) {
      const left = parts.length - 1 - i;
      if (left) print(`Stopped: ${plural(left, 'command')} after this one did not run.`, COLOR.warn);
      return;
    }
  }
}
