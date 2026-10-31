// The one table of console commands. Everything that needs to know about commands
// (running them, help, completion, which words a bind may start with, the multiplayer
// "client-only" note) asks this registry instead of keeping its own list.
//
// A command definition:
//   name, aliases       how it is typed
//   usage, desc         its line in "help"
//   help                the long form for "help <name>": { about, args, examples, notes,
//                       see, also }, every field optional ("also" adds spellings that
//                       are not aliases)
//   renderHelp()        prints the long form itself instead ("js" has a whole guide)
//   clientOnly          why it only changes your own game: a string, or (args) =>
//                       [subject, reason] when that depends on the arguments
//   handlesHelp         "<name> help" means something to the command itself
//   rawLine             the rest of the line is one argument, never split at ";"
//   keyArg              which word is a key name, so a ";" there is the key ("bind ;
//                       heal"): a number (1 is the first argument), or (words) => one;
//                       on a subcommand too, counted from the command's name
//   topicOnly           a help topic with nothing to run
//   complete(i)         words to complete argument i with
//   run(args, ctx)      args: the words after the name; ctx.rest: that text unsplit
//   subcommands         [{ name, aliases, usage, desc, help, clientOnly, reportsReach,
//                       rawLine, run(args, ctx) }]: "triggers find ...". ctx.verb is the
//                       word typed for it. reportsReach: it says itself whether others
//                       see it.

import { allowedHere } from '../core/remote.js';

const commands = [];
const byWord = new Map();

const norm = (def) => ({ aliases: [], subcommands: [], ...def });

export function register(...defs) {
  for (const raw of defs) {
    if (!allowedHere(raw)) continue; // remote play: not even listed (core/remote.js)
    const def = norm(raw);
    def.subcommands = def.subcommands.filter(allowedHere).map(norm);
    const subWords = new Set();
    for (const sub of def.subcommands) {
      for (const word of [sub.name, ...sub.aliases]) {
        if (subWords.has(word)) throw new Error(`subcommand word "${def.name} ${word}" is defined twice`);
        subWords.add(word);
      }
    }
    for (const word of [def.name, ...def.aliases]) {
      if (byWord.has(word)) throw new Error(`command word "${word}" is defined twice`);
      byWord.set(word, def);
    }
    commands.push(def);
  }
}

// By name or alias. Topic-only entries are found too: they have help, nothing to run.
export const findCommand = (word) => byWord.get(String(word || '').toLowerCase());
export const findRunnable = (word) => { const c = findCommand(word); return c && !c.topicOnly ? c : undefined; };

export const findSubcommand = (cmd, verb) => {
  const v = String(verb || '').toLowerCase();
  return v ? cmd.subcommands.find((sub) => sub.name === v || sub.aliases.includes(v)) : undefined;
};

// A subcommand verb typed on its own, as a help topic: "help find".
export function findSubcommandAnywhere(verb) {
  for (const cmd of commands) {
    const sub = findSubcommand(cmd, verb);
    if (sub) return { cmd, sub };
  }
  return null;
}

// Every first word that runs something.
export const runWords = () => commands.filter((c) => !c.topicOnly).flatMap((c) => [c.name, ...c.aliases]);
export const commandNames = () => commands.filter((c) => !c.topicOnly).map((c) => c.name);

// "help" entries in display order: every command, each followed by its subcommands.
// id is how help names it ("triggers find"); also lists its other spellings.
export function helpEntries() {
  const out = [];
  for (const cmd of commands) {
    out.push({ id: cmd.name, def: cmd, also: [...cmd.aliases, ...((cmd.help && cmd.help.also) || [])] });
    for (const sub of cmd.subcommands) {
      out.push({
        id: `${cmd.name} ${sub.name}`,
        def: sub,
        also: [...sub.aliases.map((a) => `${cmd.name} ${a}`), ...((sub.help && sub.help.also) || [])],
      });
    }
  }
  return out;
}

export const findHelpEntry = (id) => helpEntries().find((e) => e.id === id);

// Why a command, typed with these arguments, only changes your own game:
// [subject, reason], or undefined when it is not client-only.
export function reachOf(def, args) {
  const c = def.clientOnly;
  if (!c) return undefined;
  return typeof c === 'function' ? c(args) : [def.name, c];
}
