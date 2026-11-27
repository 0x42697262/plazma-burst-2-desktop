import { SAVE_KEY } from '#kernel/game-save/keys.ts';
import { EMPTY_SHOWN, HIDDEN_VALUE, PROOF_PAIR, proofHidden } from '../keys.ts';

export type Row = readonly [name: string, value: string];
export type Changed = readonly [name: string, local: string, online: string];
export type SaveDiff = Readonly<{ same: number; changed: Changed[]; onlyLocal: Row[]; onlyOnline: Row[] }>;

const byName = (first: readonly string[], second: readonly string[]): number => (first[0] ?? '').localeCompare(second[0] ?? '');

export const shownValue = (name: string, value: string): string => {
  if (name === SAVE_KEY.proof) return HIDDEN_VALUE;
  return value === '' ? EMPTY_SHOWN : value;
};

export const rowsOf = (values: ReadonlyMap<string, string>): Row[] =>
  [...values].map(([name, value]): Row => [name, shownValue(name, value)]).sort(byName);

export const hiddenText = (text: string): string => text.replace(PROOF_PAIR, (_pair, start: string) => proofHidden(start));

export function diffSaves(local: ReadonlyMap<string, string>, online: ReadonlyMap<string, string>): SaveDiff {
  let same = 0;
  const changed: Changed[] = [];
  const onlyLocal: Row[] = [];
  for (const [name, value] of local) {
    const other = online.get(name);
    if (other === undefined) onlyLocal.push([name, shownValue(name, value)]);
    else if (other === value) same++;
    else changed.push([name, shownValue(name, value), shownValue(name, other)]);
  }
  const onlyOnline = [...online].filter(([name]) => !local.has(name)).map(([name, value]): Row => [name, shownValue(name, value)]);
  return { same, changed: changed.sort(byName), onlyLocal: onlyLocal.sort(byName), onlyOnline: onlyOnline.sort(byName) };
}
