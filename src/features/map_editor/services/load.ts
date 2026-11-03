import { ROUTE, withQuery } from '#shared/contract/routes.ts';
import { nameOf } from '../domain/kinds.ts';
import { elementText, type MapDoc, type MapElement } from '../domain/doc.ts';
import { planLoad, type LoadOptions, type LoadPlan } from '../domain/merge.ts';
import { rebuildable, rebuildLive } from './rebuild.ts';
import { applyPlan, type NotLive } from './edit.ts';
import { editorDoc, docInLevel } from './session.ts';
import { NOT_FOUND_STATUS } from './constants.ts';
import { SAVE_NAME } from './keys.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

type Clipboard = { readText(): Promise<string>; writeText(text: string): Promise<void> };
export type LoadRun = LoadOptions & { dry: boolean; reset: boolean };
export type LoadResult = { plan: LoadPlan; notLive: NotLive[]; notReset: NotLive[]; reset: number };

const currentDoc = (): MapDoc => editorDoc() as MapDoc;

function clipboard(): Clipboard {
  const found = globalThis.navigator?.clipboard as Clipboard | undefined;
  if (!found) throw new Error(TEXT.noClipboard);
  return found;
}

export async function readLocalMap(name: string): Promise<string> {
  if (!SAVE_NAME.test(name)) throw new Error(TEXT.badSaveName);
  const response = await fetch(withQuery(ROUTE.localMap, { name }));
  if (response.status === NOT_FOUND_STATUS) throw new Error(TEXT.noLocalMap(name));
  if (!response.ok) throw new Error(TEXT.httpStatus(response.status));
  return response.text();
}

export async function readClipboard(): Promise<string> {
  const text = await clipboard().readText();
  if (!text.trim()) throw new Error(TEXT.emptyClipboard);
  return text;
}

export async function writeClipboard(text: string): Promise<void> {
  await clipboard().writeText(text);
}

function resetMatched(plan: LoadPlan): { reset: number; notReset: NotLive[] } {
  const doc = currentDoc();
  const notReset: NotLive[] = [];
  let reset = 0;
  if (!docInLevel()) return { reset, notReset };
  const replaced = new Set(plan.replace.map((replacement) => replacement.target));
  for (const target of [...replaced, ...plan.same]) {
    if (!target.live || target.live.index === undefined) continue;
    if (!rebuildable(target.tag)) {
      if (replaced.has(target)) notReset.push({ name: nameOf(doc, target), why: TEXT.notRebuilt });
      continue;
    }
    try {
      rebuildLive(target);
      reset++;
    } catch (error) {
      notReset.push({ name: nameOf(doc, target), why: (error as Error).message });
    }
  }
  return { reset, notReset };
}

export function loadText(text: string, run: LoadRun): LoadResult {
  const plan = planLoad(currentDoc(), text, run);
  if (run.dry) return { plan, notLive: [], notReset: [], reset: 0 };
  const notLive = applyPlan(plan);
  const { reset, notReset } = run.reset ? resetMatched(plan) : { reset: 0, notReset: [] };
  return { plan, notLive, notReset, reset };
}

export const exportText = (items: readonly MapElement[]): string => items.map(elementText).join(TEXT.lineBreak);
