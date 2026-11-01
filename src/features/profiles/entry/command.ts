import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '#console/kernel/core/keys.ts';
import { BIND_KEY_WIDTH, BIND_MIN_ARGUMENTS, KEY_WIDTH, NAME_WIDTH, SET_ARGUMENTS, UNSET_ARGUMENTS, USE_MAX_ARGUMENTS, VALUE_WIDTH } from '../constants.ts';
import { BIND_KEY_ARGUMENT, CLEAR, COMMAND, LIST_SEPARATOR, NONE } from '../keys.ts';
import { TEXT } from '../text.ts';
import { profileContext as context, profileStore as profiles, type Profile } from '../adapters/store.ts';

type Args = readonly string[];

const isNone = (name: string): boolean => name.toLowerCase() === NONE;

function requireMap(): string {
  const id = context.currentMap();
  if (!id) throw new Error(TEXT.noMap);
  return id;
}

function requireProfile(name: string | undefined): string {
  if (!name) throw new Error(TEXT.whichProfile);
  if (!profiles.exists(name)) throw new Error(TEXT.noProfile(name));
  return name;
}

function requireGameKey(word: string | undefined): string {
  const key = context.resolveKey(word ?? '');
  if (!key) throw new Error(TEXT.unknownKey(word ?? ''));
  if (!context.affectsGame(key)) throw new Error(TEXT.consoleKey(key));
  return key;
}

export function summary(profile: Profile): string {
  const parts = Object.keys(profile.values).sort().map((key) => TEXT.summaryValue(key, context.showValue(key, profile.values[key])));
  const bindCount = Object.keys(profile.binds).length;
  if (bindCount) parts.push(TEXT.plural(bindCount, TEXT.bindWord));
  if (profile.onload) parts.push(TEXT.onloadWord);
  return parts.length ? parts.join(LIST_SEPARATOR) : TEXT.nothingYet;
}

function printProfile(profile: Profile): void {
  const keys = Object.keys(profile.values).sort();
  const bindKeys = Object.keys(profile.binds).sort();
  if (!keys.length && !bindKeys.length && !profile.onload) {
    print(TEXT.setsNothing, COLOR.notice);
    return;
  }
  for (const key of keys) {
    const yours = context.hasOwnSetting(key) ? context.showValue(key, context.ownSetting(key)) : TEXT.defaultWord;
    print([[TEXT.valueRow(key.padEnd(KEY_WIDTH), context.showValue(key, profile.values[key]).padEnd(VALUE_WIDTH)), COLOR.ok], [TEXT.yours(yours), COLOR.hint, true]]);
  }
  for (const key of bindKeys) print([[TEXT.bindRow(context.showKey(key).padEnd(BIND_KEY_WIDTH), profile.binds[key] ?? ''), COLOR.ok]]);
  if (profile.onload) print([[TEXT.onloadLabel, COLOR.ok], [profile.onload, COLOR.ok]]);
}

function status(): void {
  const id = context.currentMap();
  if (!id) {
    print(TEXT.noMapLoaded, COLOR.notice);
    return;
  }
  const profile = context.active();
  if (!profile) {
    print(TEXT.mapWithout(id), COLOR.notice);
    return;
  }
  print(TEXT.mapUses(id, profile.name), COLOR.title);
  printProfile(profile);
}

function list(): void {
  const names = profiles.names();
  if (!names.length) {
    print(TEXT.noProfiles, COLOR.notice);
    return;
  }
  const active = context.active();
  print(TEXT.profilesTitle(names.length), COLOR.title);
  for (const name of names) {
    const isHere = active?.name === name;
    print([[TEXT.listRow(name.padEnd(NAME_WIDTH), summary(profiles.get(name))), isHere ? COLOR.ok : undefined],
      [TEXT.listMaps(profiles.mapsUsing(name).join(LIST_SEPARATOR), isHere ? TEXT.thisMap : ''), COLOR.hint, true]]);
  }
}

function show(args: Args): void {
  const name = requireProfile(args[0]);
  print(TEXT.showTitle(name, profiles.mapsUsing(name)), COLOR.title);
  printProfile(profiles.get(name));
}

function use(args: Args): void {
  const [name, given] = args;
  if (!name || args.length > USE_MAX_ARGUMENTS) throw new Error(TEXT.useUsage);
  const id = given || requireMap();
  const was = profiles.of(id);
  if (isNone(name)) {
    profiles.use(id, null);
    print(was ? TEXT.noneNow(id, was) : TEXT.hadNone(id), was ? COLOR.ok : COLOR.notice);
    return;
  }
  const isNew = !profiles.exists(name);
  profiles.use(id, name);
  print(TEXT.usesNow(id, name, isNew, was, summary(profiles.get(name))), COLOR.ok);
  if (isNew) print(TEXT.fillIt(name), COLOR.hint);
}

function setValue(args: Args): void {
  const [name, word, raw] = args;
  if (args.length !== SET_ARGUMENTS || !name || raw === undefined) throw new Error(TEXT.setUsage);
  if (isNone(name)) throw new Error(TEXT.noneIsReserved);
  const key = requireGameKey(word);
  const value = context.parseValue(key, raw);
  const isNew = !profiles.exists(name);
  profiles.set(name, key, value);
  print(TEXT.setDone(name, key, context.showValue(key, value), isNew), COLOR.ok);
}

function unsetValue(args: Args): void {
  if (args.length !== UNSET_ARGUMENTS) throw new Error(TEXT.unsetUsage);
  const name = requireProfile(args[0]);
  const key = requireGameKey(args[1]);
  if (!Object.hasOwn(profiles.get(name).values, key)) {
    print(TEXT.doesNotSet(name, key), COLOR.notice);
    return;
  }
  profiles.unset(name, key);
  print(TEXT.unsetDone(name, key), COLOR.ok);
}

function bind(args: Args): void {
  const [name, word] = args;
  if (args.length < BIND_MIN_ARGUMENTS || !name || !word) throw new Error(TEXT.bindUsage);
  if (isNone(name)) throw new Error(TEXT.noneIsReserved);
  const key = context.parseKeyName(word);
  const old = profiles.exists(name) ? profiles.get(name).binds[key] : undefined;
  if (args.length === BIND_MIN_ARGUMENTS) {
    print(old ? TEXT.bindShown(name, context.showKey(key), old) : TEXT.doesNotBind(name, context.showKey(key)), old ? undefined : COLOR.notice);
    return;
  }
  const command = context.commandText(args.slice(BIND_MIN_ARGUMENTS), TEXT.bindUsage);
  profiles.bind(name, key, command);
  print(TEXT.bindDone(name, context.showKey(key), command, old), COLOR.ok);
  print(TEXT.bindWhere(name, profiles.mapsUsing(name), context.showKey(key)), COLOR.hint);
  context.warnKeyUses(key);
}

function unbind(args: Args): void {
  if (args.length !== UNSET_ARGUMENTS) throw new Error(TEXT.unbindUsage);
  const name = requireProfile(args[0]);
  const key = context.parseKeyName(args[1] ?? '');
  const old = profiles.get(name).binds[key];
  if (!old) {
    print(TEXT.doesNotBind(name, context.showKey(key)), COLOR.notice);
    return;
  }
  profiles.unbind(name, key);
  print(TEXT.unbindDone(name, context.showKey(key), old), COLOR.ok);
}

function onload(args: Args): void {
  const [name, ...rest] = args;
  if (!name) throw new Error(TEXT.onloadUsage);
  if (isNone(name)) throw new Error(TEXT.noneIsReserved);
  if (!rest.length) {
    const now = profiles.exists(name) ? profiles.get(name).onload : '';
    print(now ? TEXT.onloadShown(name, now) : TEXT.runsNothing(name), now ? undefined : COLOR.notice);
    return;
  }
  const isClear = rest.length === 1 && rest[0]?.toLowerCase() === CLEAR;
  if (isClear) {
    requireProfile(name);
    profiles.setOnload(name, '');
    print(TEXT.onloadCleared(name), COLOR.ok);
    return;
  }
  const command = context.commandText(rest, TEXT.onloadUsage);
  profiles.setOnload(name, command);
  print(TEXT.onloadShown(name, command), COLOR.ok);
  print(TEXT.onloadWhen(name), COLOR.hint);
}

function remove(args: Args): void {
  if (args.length !== 1) throw new Error(TEXT.deleteUsage);
  const name = requireProfile(args[0]);
  print(TEXT.deleted(name, profiles.remove(name)), COLOR.ok);
}

const { sub } = TEXT;

export const profileCommand = Object.freeze({
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about(context.gameKeyGroups()), args: TEXT.args, examples: TEXT.examples, notes: TEXT.notes, see: TEXT.see },
  run: status,
  subcommands: [
    { name: COMMAND.list, aliases: COMMAND.listAliases, usage: sub.list.usage, desc: sub.list.desc, help: { see: sub.list.see }, run: list },
    { name: COMMAND.show, usage: sub.show.usage, desc: sub.show.desc, help: { see: sub.show.see }, run: show },
    { name: COMMAND.use, usage: sub.use.usage, desc: sub.use.desc, help: { about: sub.use.about, see: sub.use.see }, run: use },
    { name: COMMAND.set, usage: sub.set.usage, desc: sub.set.desc, help: { see: sub.set.see }, run: setValue },
    { name: COMMAND.unset, aliases: COMMAND.unsetAliases, usage: sub.unset.usage, desc: sub.unset.desc, help: { see: sub.unset.see }, run: unsetValue },
    { name: COMMAND.bind, usage: sub.bind.usage, desc: sub.bind.desc, keyArg: BIND_KEY_ARGUMENT, help: { about: sub.bind.about, see: sub.bind.see }, run: bind },
    { name: COMMAND.unbind, usage: sub.unbind.usage, desc: sub.unbind.desc, keyArg: BIND_KEY_ARGUMENT, help: { see: sub.unbind.see }, run: unbind },
    { name: COMMAND.onload, aliases: COMMAND.onloadAliases, usage: sub.onload.usage, desc: sub.onload.desc, help: { about: sub.onload.about, see: sub.onload.see }, run: onload },
    { name: COMMAND.delete, aliases: COMMAND.deleteAliases, usage: sub.delete.usage, desc: sub.delete.desc, help: { see: sub.delete.see }, run: remove },
  ],
});
