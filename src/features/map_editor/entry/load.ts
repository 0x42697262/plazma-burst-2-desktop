import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { oneOf, takeValueOptions } from '#console/kernel/core/args.ts';
import { player } from '#console/kernel/game/level.ts';
import type { MapDoc, MapElement, Spot } from '../domain/doc.ts';
import type { Placement } from '../domain/merge.ts';
import { editorDoc, selected } from '../services/session.ts';
import { saveText } from '../services/edit.ts';
import { exportText, loadText, readClipboard, readLocalMap, writeClipboard, type LoadResult, type LoadRun } from '../services/load.ts';
import { EXISTS_PATTERN, EXPORT_OPTION, EXPORT_VALUED, LAYER_WORD_SEPARATOR, LOAD_FLAGS, LOAD_OPTION, LOAD_VALUED, NAME_JOIN, PLACEMENT_OPTIONS } from '../keys.ts';
import { COMMAND_TEXT as TEXT } from '../text.ts';
import { kindsOf, kindWords, requireShown } from './common.ts';

const currentDoc = (): MapDoc => editorDoc() as MapDoc;

function spotOf(option: string, values: readonly string[] | undefined): Spot | undefined {
  if (!values) return undefined;
  const [first, second] = values.map(Number);
  if (!Number.isFinite(first) || !Number.isFinite(second)) throw new Error(TEXT.twoNumbers(option));
  return { x: first as number, y: second as number };
}

function crosshair(): Spot {
  const me = player();
  if (!me) throw new Error(TEXT.noPlayer);
  return { x: Math.round(me.tarx as number), y: Math.round(me.tary as number) };
}

function loadRunOf(args: readonly string[]): { words: string[]; run: LoadRun } {
  const { options, values, rest } = takeValueOptions(args, LOAD_FLAGS, LOAD_VALUED);
  oneOf(options, [LOAD_OPTION.add, LOAD_OPTION.sync]);
  oneOf(options, [LOAD_OPTION.add, LOAD_OPTION.reset]);
  oneOf(options, PLACEMENT_OPTIONS);
  const onlyWord = values.get(LOAD_OPTION.only)?.[0];
  const only = onlyWord === undefined ? null : kindsOf(onlyWord);
  if (onlyWord !== undefined && !only) throw new Error(TEXT.badKinds(onlyWord, kindWords));
  const offset = spotOf(LOAD_OPTION.offset, values.get(LOAD_OPTION.offset));
  const at = options.has(LOAD_OPTION.here) ? crosshair() : spotOf(LOAD_OPTION.at, values.get(LOAD_OPTION.at));
  const placement: Placement = offset ? { offset } : at ? { at } : null;
  return {
    words: rest,
    run: {
      add: options.has(LOAD_OPTION.add),
      sync: options.has(LOAD_OPTION.sync),
      only: only ? new Set(only) : null,
      placement,
      mapNumbers: options.has(LOAD_OPTION.mapNumbers),
      dry: options.has(LOAD_OPTION.dry),
      reset: options.has(LOAD_OPTION.reset),
    },
  };
}

function report(source: string, { plan, notLive, notReset, reset }: LoadResult, dry: boolean): void {
  const counts = { replaced: plan.replace.length, added: plan.add.length, deleted: plan.remove.length, unchanged: plan.same.length };
  print(TEXT.loaded(dry, source, TEXT.loadCounts(counts)), COLOR.ok);
  if (plan.renamed.length) print(TEXT.renamed(plan.renamed.map(([from, to]) => TEXT.renamePair(from, to)).join(TEXT.listSeparator)));
  for (const reference of plan.dangling) print(TEXT.dangling(reference.from, reference.attr, reference.value), COLOR.notice);
  for (const skip of plan.skipped) print(TEXT.skipped(skip.name, skip.why), COLOR.notice);
  for (const item of notLive) print(TEXT.loadNotLive(item.name, item.why), COLOR.notice);
  if (reset) print(TEXT.rebuilt(reset));
  for (const item of notReset) print(TEXT.notRebuilt(item.name, item.why), COLOR.notice);
  const changedSomething = counts.replaced + counts.added + counts.deleted > 0;
  if (!dry && changedSomething) print(TEXT.undoLoad);
}

function runLoad(source: string, read: () => Promise<string>, run: LoadRun): Promise<void> {
  return read()
    .then((text) => {
      requireShown();
      report(source, loadText(text, run), run.dry);
    })
    .catch((error: Error) => { print(TEXT.error(TEXT.couldNotLoad(error.message || TEXT.desktopOnly)), COLOR.error); });
}

export function load(args: string[]): Promise<void> {
  requireShown();
  const { words, run } = loadRunOf(args);
  const name = words.join(NAME_JOIN).trim();
  if (!name) throw new Error(TEXT.loadUsage);
  return runLoad(name, () => readLocalMap(name), run);
}

export function paste(args: string[]): Promise<void> {
  requireShown();
  const { words, run } = loadRunOf(args);
  if (words.length) throw new Error(TEXT.pasteUsage);
  return runLoad(TEXT.clipboardSource, readClipboard, run);
}

function exported(words: readonly string[]): MapElement[] {
  if (!words.length) {
    const current = selected();
    if (!current) throw new Error(TEXT.nothingToExport);
    return [current];
  }
  const word = words.join(LAYER_WORD_SEPARATOR);
  const tags = kindsOf(word);
  if (!tags) throw new Error(TEXT.badKinds(word, kindWords));
  const items = currentDoc().elements.filter((item) => tags.includes(item.tag));
  if (!items.length) throw new Error(TEXT.nothingToExport);
  return items;
}

export function exportCommand(args: string[]): Promise<void> {
  requireShown();
  const { options, values, rest } = takeValueOptions(args, [EXPORT_OPTION.force], EXPORT_VALUED);
  const name = values.get(EXPORT_OPTION.to)?.[0];
  if (options.has(EXPORT_OPTION.force) && !name) throw new Error(TEXT.exportUsage);
  const items = exported(rest);
  const text = exportText(items);
  if (!name) {
    return writeClipboard(text).then(
      () => { print(TEXT.exportedClipboard(items.length), COLOR.ok); },
      (error: Error) => { print(TEXT.error(TEXT.couldNotCopy(error.message)), COLOR.error); },
    );
  }
  return saveText(name, text, { overwrite: options.has(EXPORT_OPTION.force) }).then(
    ({ file }) => { print(TEXT.exportedFile(items.length, file, name), COLOR.ok); },
    (error: Error) => {
      print(TEXT.error(EXISTS_PATTERN.test(error.message) ? TEXT.exportExists(error.message, name) : TEXT.couldNotSave(error.message || TEXT.desktopOnly)), COLOR.error);
    },
  );
}
