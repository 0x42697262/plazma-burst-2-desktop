import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { showKey } from '#console/kernel/state/key-names.ts';
import { SETTING } from '#features/map_editor/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { player } from '#console/kernel/game/level.ts';
import { hasLayer } from '#console/kernel/ui/overlay.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import type { CommandContext, CommandDefinition } from '#console/kernel/commands/registry.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { nameOf, kindOf, KINDS, KIND_TAGS, SHAPE, type Kind } from '../domain/kinds.ts';
import type { MapDoc } from '../domain/doc.ts';
import {
  editorDoc, editorShown, selected, isPending, setTool, showLayer, TOOL, selectableLayers, setSelectable, LAYER_GROUPS,
} from '../services/session.ts';
import {
  setAttr, saveMap, addElement, deleteElement, duplicateElement, undo, redo, notLiveReason, resetEdits,
} from '../services/edit.ts';
import { editorOn, setEditorOn } from '../ui/editor.ts';
import { inputStatus } from '../ui/input.ts';
import { panelsOnPage } from '../ui/panels.ts';
import { LAYER_NAME } from '../ui/keys.ts';
import { ADD_ARG_COUNTS, SET_MIN_ARGS, TOOL_MAX_ARGS } from '../constants.ts';
import {
  COMMAND, EXISTS_PATTERN, NAME_JOIN, FIRST_TWO_WORDS, FORCE_OPTION, LAYER_ALL, LAYER_NONE_WORDS, LAYER_SIGN, LAYER_WORD_SEPARATOR, OFF_WORDS, ON_WORDS,
  QUOTED_VALUE, SELECT_WORD, PLACE_WORD, SIGNED_LAYER, UNQUOTE,
} from '../keys.ts';
import { COMMAND_TEXT as TEXT, EDITOR_HELP, SUBCOMMAND_HELP, UNDO_VERB } from '../text.ts';

const kindTitle = (tag: string): string => (KINDS[tag] as Kind).title;

function editor(args: string[]): void {
  if (args.length > 1) throw new Error(TEXT.usage);
  const word = (args[0] || '').toLowerCase();
  const want = !word ? !editorOn() : ON_WORDS.includes(word) ? true : OFF_WORDS.includes(word) ? false : null;
  if (want === null) throw new Error(TEXT.usage);
  if (!setEditorOn(want)) {
    print(TEXT.already(want), COLOR.notice);
    return;
  }
  const key = settings.effective(SETTING.editorKey);
  const again = key ? TEXT.keyOrCommand(showKey(stringOf(key))) : TEXT.commandOnly;
  print(want ? TEXT.on(again) : TEXT.off, COLOR.ok);
}

function requireShown(): void {
  if (!editorShown()) throw new Error(TEXT.notShown);
}

const currentDoc = (): MapDoc => editorDoc() as MapDoc;

function needSelection(): NonNullable<ReturnType<typeof selected>> {
  const current = selected();
  if (!current) throw new Error(TEXT.selectFirst);
  return current;
}

function setOne(args: string[], { rest }: CommandContext): void {
  requireShown();
  if (args.length < SET_MIN_ARGS) throw new Error(TEXT.setUsage);
  const current = selected();
  if (!current) throw new Error(TEXT.selectFirst);
  const attr = args[0] as string;
  const value = rest.replace(FIRST_TWO_WORDS, '').replace(QUOTED_VALUE, UNQUOTE);
  const { changed, live, why } = setAttr(current, attr, value);
  const name = nameOf(currentDoc(), current);
  if (!changed) {
    print(TEXT.alreadyValue(name, attr, value), COLOR.notice);
    return;
  }
  const where = live ? TEXT.liveNow : TEXT.notInLevel(why ?? '');
  print(TEXT.setDone(name, attr, value, where), live ? COLOR.ok : COLOR.notice);
}

function save(rawArgs: string[]): Promise<void> {
  requireShown();
  const { options, rest } = takeOptions(rawArgs, [FORCE_OPTION]);
  const name = rest.join(NAME_JOIN).trim();
  if (!name) throw new Error(TEXT.saveUsage);
  return saveMap(name, { overwrite: options.has(FORCE_OPTION) }).then(
    ({ file, id }) => { print(TEXT.saved(file, id), COLOR.ok); },
    (error: Error) => {
      print(TEXT.error(EXISTS_PATTERN.test(error.message) ? TEXT.exists(error.message, name) : TEXT.couldNotSave(error.message || TEXT.desktopOnly)), COLOR.error);
    },
  );
}

function kindWord(word: string | undefined): string | null {
  const lowered = stringOf(word || '').toLowerCase();
  return KIND_TAGS.find((tag) => tag === lowered || kindTitle(tag) === lowered) || null;
}
const kindWords = KIND_TAGS.map(kindTitle).join(TEXT.listSeparator);

function add(args: string[]): void {
  requireShown();
  const usage = TEXT.addUsage(kindWords);
  const tag = kindWord(args[0]);
  if (!tag || !ADD_ARG_COUNTS.includes(args.length)) throw new Error(usage);
  const numbers = args.slice(1).map(Number);
  if (!numbers.every(Number.isFinite)) throw new Error(usage);
  const [atX, atY, width, height] = numbers.length ? numbers : (() => {
    const me = player() as NonNullable<ReturnType<typeof player>>;
    return [Math.round(me.tarx as number), Math.round(me.tary as number)];
  })();
  const item = addElement(tag, { x: atX as number, y: atY as number, ...(width !== undefined ? { w: width, h: height } : {}) });
  showLayer(tag);
  const why = notLiveReason();
  const where = isPending(item) ? TEXT.notInLevel(why || TEXT.notMade)
    : why ? TEXT.inLevelBut(why) : TEXT.inLevel;
  const size = (kindOf(tag) as Kind).shape === SHAPE.RECT ? TEXT.size(item.attrs.w, item.attrs.h) : '';
  print(TEXT.added(nameOf(currentDoc(), item), atX as number, atY as number, size, where), COLOR.ok);
}

function reset(args: string[]): void {
  if (args.length) throw new Error(TEXT.resetUsage);
  if (!editorDoc()) {
    print(TEXT.nothingToReset, COLOR.ok);
    return;
  }
  const { undone, notBack } = resetEdits();
  print(TEXT.resetDone(undone), COLOR.ok);
  if (notBack) print(TEXT.notBack(notBack), COLOR.notice);
}

function del(): void {
  requireShown();
  const current = needSelection();
  const name = nameOf(currentDoc(), current);
  deleteElement(current);
  print(TEXT.deleted(name), COLOR.ok);
}

function copy(): void {
  requireShown();
  const item = duplicateElement(needSelection());
  print(TEXT.copied(nameOf(currentDoc(), item)), COLOR.ok);
}

const undoRedo = (action: () => boolean, verb: string) => (): void => {
  requireShown();
  if (action()) print(TEXT.didIt(verb), COLOR.ok);
  else print(TEXT.nothingTo(verb), COLOR.notice);
};

function tool(args: string[]): void {
  requireShown();
  const usage = TEXT.toolUsage(kindWords);
  const word = (args[0] || '').toLowerCase();
  if (word === SELECT_WORD && args.length === 1) {
    setTool(TOOL.SELECT);
    print(TEXT.toolSelect, COLOR.ok);
    return;
  }
  if (word !== PLACE_WORD || args.length > TOOL_MAX_ARGS) throw new Error(usage);
  if (args[1]) {
    const tag = kindWord(args[1]);
    if (!tag) throw new Error(usage);
    showLayer(tag);
  }
  setTool(TOOL.PLACE);
  print(TEXT.toolPlace, COLOR.ok);
}

function status(): void {
  const doc = editorDoc();
  const current = selected();
  const input = inputStatus();
  const { window: windowPress, layer: layerPress } = input.lastPress;
  print(TEXT.statusTitle, COLOR.title);
  print(TEXT.statusOn(editorOn(), editorShown()));
  print(TEXT.statusMap(doc ? { elements: doc.elements.length, withUid: doc.elements.filter((item) => item.attrs.uid).length } : null));
  print(TEXT.statusLayers(hasLayer(LAYER_NAME), panelsOnPage(), input.listening));
  print(TEXT.statusLocked(input.pointerLocked));
  print(TEXT.statusWindowPress(windowPress));
  print(TEXT.statusLayerPress(layerPress));
  print(TEXT.statusSelected(current && doc ? nameOf(doc, current) : null));
}

function layers(args: string[]): void {
  requireShown();
  const usage = TEXT.layersUsage(kindWords);
  const word = args.join(LAYER_WORD_SEPARATOR).toLowerCase();
  if (!word) throw new Error(usage);
  let tags: (string | null)[];
  if (word === LAYER_ALL) tags = [...KIND_TAGS];
  else if (LAYER_NONE_WORDS.includes(word)) tags = [];
  else if (Object.hasOwn(LAYER_GROUPS, word)) tags = [...LAYER_GROUPS[word] ?? []];
  else if (SIGNED_LAYER.test(word)) {
    const tag = kindWord(word.slice(1));
    if (!tag) throw new Error(usage);
    tags = word[0] === LAYER_SIGN.add ? [...new Set([...selectableLayers(), tag])] : selectableLayers().filter((other) => other !== tag);
  } else {
    tags = word.split(LAYER_WORD_SEPARATOR).filter(Boolean).map(kindWord);
    if (!tags.length || tags.includes(null)) throw new Error(usage);
  }
  setSelectable(tags);
  const now = selectableLayers();
  print(TEXT.layersNow(now.map(kindTitle)), COLOR.ok);
}

const HELP = SUBCOMMAND_HELP(kindWords);
const subcommand = (key: keyof typeof HELP, run: CommandDefinition['run']): CommandDefinition => ({ ...HELP[key], run });

export const editorCommand: CommandDefinition = {
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: TEXT.commandUsage,
  desc: TEXT.commandDesc,
  help: EDITOR_HELP(REMOTE),
  run: editor,
  subcommands: [
    subcommand('status', status),
    subcommand('layers', layers),
    subcommand('set', setOne),
    subcommand('add', add),
    subcommand('delete', del),
    subcommand('copy', copy),
    subcommand('undo', undoRedo(undo, UNDO_VERB.undo)),
    subcommand('redo', undoRedo(redo, UNDO_VERB.redo)),
    subcommand('tool', tool),
    subcommand('reset', reset),
    subcommand('save', save),
  ],
};
