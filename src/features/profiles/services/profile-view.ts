import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { BIND_KEY_WIDTH, KEY_WIDTH, VALUE_WIDTH } from '../constants.ts';
import { LIST_SEPARATOR, NONE } from '../keys.ts';
import { TEXT } from '../text.ts';
import { profileContext as context, profileStore as profiles, type Profile } from '../adapters/store.ts';

export const isNone = (name: string): boolean => name.toLowerCase() === NONE;

export function requireProfile(name: string | undefined): string {
  if (!name) throw new Error(TEXT.whichProfile);
  if (!profiles.exists(name)) throw new Error(TEXT.noProfile(name));
  return name;
}

export function requireGameKey(word: string | undefined): string {
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

export function printProfile(profile: Profile): void {
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
