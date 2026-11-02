import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { requireVars, showVar, SYNC_MODES, RECOMMENDED_MODE, VAR_MAX_LEN, fights, modeName, syncMarkOn, mapHasSyncMark, syncActionsFor, seedersFor, modeVerdict, NO, YES } from '../../vars.ts';
import { SYNC_MODE_KEYS, type SyncModeKey } from '../../keys.ts';
import { ACTION_WIDTH, INDEX_WIDTH, MODE_WHAT_WIDTH, NAME_AND_VALUE, SHOWN, UID_WIDTH, VERDICT_WIDTH } from '../../entry/constants.ts';
import { HASH, NO_UID, VARS_COMMAND } from '../../entry/keys.ts';
import { TEXT } from './text.ts';
import { COMMAND } from './keys.ts';

type Vars = Record<string, unknown>;

const isSyncMode = (mode: string): mode is SyncModeKey => (SYNC_MODE_KEYS as readonly string[]).includes(mode);

const fightName = (mode: SyncModeKey): string => SYNC_MODES[mode].what;

const uidText = (uid: string | undefined): string => (uid || NO_UID).padEnd(UID_WIDTH);

function explainMark(): void {
  const local = syncMarkOn();
  const inMap = mapHasSyncMark();
  print(TEXT.markLine(local, inMap), local && inMap !== false ? COLOR.ok : COLOR.warn);
  if (!local) print(TEXT.noMark, COLOR.warn);
  else if (inMap === false) print(TEXT.leftoverMark, COLOR.warn);
  if (!game.isMP()) print(TEXT.singlePlayerNote, COLOR.warn);
}

function explainSyncers(name: string): boolean {
  const synced = syncActionsFor(name);
  const fighting = synced.filter((action) => fights(action.mode));
  if (!synced.length) {
    print(TEXT.noSyncers, COLOR.ok);
    return false;
  }
  print(TEXT.syncers(plural(synced.length, TEXT.triggerActionNoun)), COLOR.warn);
  for (const action of synced.slice(0, SHOWN.syncers)) print(TEXT.syncerRow(String(action.idx).padEnd(INDEX_WIDTH), uidText(action.uid), String(action.action).padEnd(ACTION_WIDTH), modeName(action.mode)));
  if (synced.length > SHOWN.syncers) print(TEXT.more(synced.length - SHOWN.syncers));
  const [firstFighting] = fighting;
  if (firstFighting) print(TEXT.canUndo(fightName(firstFighting.mode), firstFighting.idx), COLOR.warn);
  return fighting.length > 0;
}

function explainSeeders(name: string): number {
  const seeders = seedersFor(name);
  if (!seeders.length) return 0;
  print(TEXT.seeders(plural(seeders.length, TEXT.triggerNoun)), COLOR.warn);
  print(TEXT.seedersOverwrite, COLOR.warn);
  for (const seeder of seeders.slice(0, SHOWN.seeders)) print(TEXT.seederRow(String(seeder.idx).padEnd(INDEX_WIDTH), uidText(seeder.uid), String(seeder.action).padEnd(ACTION_WIDTH), seeder.atStart));
  if (seeders.length > SHOWN.seeders) print(TEXT.more(seeders.length - SHOWN.seeders));
  print(TEXT.holdsFor, COLOR.warn);
  print(TEXT.testElsewhere, COLOR.warn);
  return seeders.length;
}

function explainSync(name: string, vars: Vars): void {
  const has = Object.hasOwn(vars, name);
  const value = vars[name];
  print(TEXT.syncTitle(name), COLOR.title);
  print(TEXT.valueToSend(has ? showVar(value) : null), has ? undefined : COLOR.notice);
  explainMark();
  const syncedCount = syncActionsFor(name).length;
  const fighting = explainSyncers(name);
  const seederCount = explainSeeders(name);
  if (has) {
    print(TEXT.modesTitle, COLOR.title);
    for (const mode of SYNC_MODE_KEYS) {
      const [verdict, why] = modeVerdict(mode, value);
      print([[TEXT.modeRow(mode, SYNC_MODES[mode].what.padEnd(MODE_WHAT_WIDTH), verdict.padEnd(VERDICT_WIDTH)), verdict === NO ? COLOR.muted : COLOR.bright], [why, COLOR.hint]]);
    }
    print(TEXT.recommended(name, RECOMMENDED_MODE, fighting), COLOR.ok);
    if (seederCount || syncedCount) print(TEXT.oneLine(name, RECOMMENDED_MODE), COLOR.hint);
  }
  if (name.includes(HASH) || (has && stringOf(value).includes(HASH))) print(TEXT.hashWarning, COLOR.warn);
}

function syncVar(args: readonly string[]): void {
  const vars = requireVars();
  const usage = TEXT.syncUsage(SYNC_MODE_KEYS);
  const [name, typedMode] = args;
  if (!name || args.length > NAME_AND_VALUE) throw new Error(usage);
  if (typedMode === undefined) {
    explainSync(name, vars);
    return;
  }
  const mode = typedMode.toLowerCase();
  if (!isSyncMode(mode)) throw new Error(TEXT.noMode(typedMode, SYNC_MODE_KEYS.map(modeName).join(TEXT.modeSeparator)));
  if (!Object.hasOwn(vars, name)) throw new Error(TEXT.setFirst(name));
  const value = vars[name];
  if (!syncMarkOn()) throw new Error(TEXT.noMarkError);
  if (!game.isMP()) throw new Error(TEXT.singlePlayerError);
  if (name.length > VAR_MAX_LEN || stringOf(value).length > VAR_MAX_LEN) throw new Error(TEXT.tooLong(VAR_MAX_LEN));
  const [verdict, why] = modeVerdict(mode, value);
  if (verdict === NO) throw new Error(TEXT.cannotDeliver(modeName(mode), showVar(value), why, name, RECOMMENDED_MODE));
  game.sendVarSync(mode, name, value);
  print(TEXT.sent(name, showVar(value), modeName(mode), SYNC_MODES[mode].how), COLOR.ok);
  const fighting = syncActionsFor(name).filter((action) => fights(action.mode));
  const [firstFighting] = fighting;
  if (firstFighting) print(TEXT.mayUndo(plural(fighting.length, TEXT.triggerActionNoun), fightName(firstFighting.mode), firstFighting.idx), COLOR.warn);
  if (verdict !== YES) print(TEXT.conditional(mode, verdict, why), COLOR.hint);
  const [firstSeeder] = seedersFor(name);
  if (firstSeeder) print(TEXT.seederNote(firstSeeder.idx, firstSeeder.uid || '', firstSeeder.atStart), COLOR.warn);
}

const SYNC_HELP_ARGS = [TEXT.sync.nameArgument, ...SYNC_MODE_KEYS.map((mode) => [mode, TEXT.modeHelp(SYNC_MODES[mode].what, SYNC_MODES[mode].how)] as const)];

export const varsSyncCommand = Object.freeze({
  parent: VARS_COMMAND.name,
  name: COMMAND.name,
  usage: TEXT.sync.usage,
  desc: TEXT.sync.desc,
  reportsReach: true,
  help: { args: SYNC_HELP_ARGS, about: TEXT.sync.about, examples: TEXT.sync.examples, notes: TEXT.sync.notes(VAR_MAX_LEN), see: TEXT.sync.see },
  run: (args: string[]) => { syncVar(args); },
});
