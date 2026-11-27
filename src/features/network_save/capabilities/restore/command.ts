import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { agoText } from '#console/kernel/core/words.ts';
import { STATUS } from '#shared/contract/keys.ts';
import { decodeSaveText } from '#kernel/game-save/save-text.ts';
import { SAVE_KEY } from '#kernel/game-save/keys.ts';
import { BACKUP_KIND, BACKUP_OPTION, COMMAND, SUBCOMMAND, WORD_SEPARATOR, YES_OPTION } from '../../keys.ts';
import { BACKUP_TEXT, SHARED_TEXT } from '../../text.ts';
import { gameSave } from '../../adapters/game.ts';
import { downloadSave, listBackups, readBackup, uploadSaveText, type Backup } from '../../adapters/wrapper-client.ts';
import { diffSaves } from '../../domain/view.ts';
import { isNothingToLoad } from '../../domain/answer.ts';
import { backupLocal } from '../../services/backup.ts';
import { TEXT } from './text.ts';

type Plan = Readonly<{ isYes: boolean; backup: number | null }>;

function planOf(args: readonly string[]): Plan {
  let isYes = false;
  let backup: number | null = null;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === YES_OPTION && !isYes) isYes = true;
    else if (arg === BACKUP_OPTION && backup === null) {
      const number = Number(args[++index]);
      if (!Number.isInteger(number) || number < 1) throw new Error(TEXT.usageError);
      backup = number;
    } else throw new Error(TEXT.usageError);
  }
  return { isYes, backup };
}

const localUid = (): string => gameSave.saveData()[SAVE_KEY.uid] as string | undefined ?? TEXT.noDevice;
const warnDevice = (to: string | undefined): void => {
  const from = localUid();
  const next = to ?? TEXT.noDevice;
  if (from !== next) print(TEXT.deviceChange(from, next), COLOR.warn);
};
const goLine = (plan: Plan): string => [COMMAND.name, SUBCOMMAND.restore, ...(plan.backup === null ? [] : [BACKUP_OPTION, String(plan.backup)])].join(WORD_SEPARATOR);

async function restoreOnline(login: string, plan: Plan): Promise<void> {
  print(TEXT.asking(login), COLOR.hint);
  const { status, text } = await downloadSave();
  if (status !== STATUS.ok) return print(SHARED_TEXT.siteRefused(status), COLOR.error);
  if (isNothingToLoad(text)) return print(TEXT.nothing(login), COLOR.notice);
  const online = decodeSaveText(text);
  const changes = diffSaves(decodeSaveText(gameSave.saveText(true)), online);
  print(TEXT.wouldOnline(login, online.size, changes.changed.length + changes.onlyOnline.length), COLOR.title);
  warnDevice(online.get(SAVE_KEY.uid));
  if (!plan.isYes) return print(TEXT.howToGo(goLine(plan)), COLOR.hint);
  print(TEXT.localKept(await backupLocal(login, BACKUP_TEXT.beforeRestore)), COLOR.hint);
  gameSave.saveApply(text);
  print(TEXT.restoredOnline(login, online.size), COLOR.ok);
  return print(TEXT.reload, COLOR.hint);
}

const valuesOf = (backup: Backup): Map<string, string> => (backup.data
  ? new Map(Object.entries(backup.data).map(([name, value]) => [name, String(value)]))
  : decodeSaveText(backup.text ?? ''));

async function restoreBackup(login: string, plan: Plan, number: number): Promise<void> {
  const list = await listBackups();
  const summary = list[number - 1];
  if (!summary) return print(TEXT.noBackup(String(number), list.length), COLOR.error);
  const backup = await readBackup(summary.id);
  const values = valuesOf(backup);
  print(TEXT.wouldBackup(String(number), backup.kind, backup.login, backup.reason, agoText(Date.now() - backup.at), login), COLOR.title);
  if (backup.login.toLowerCase() !== login.toLowerCase()) print(TEXT.otherAccount(backup.login, login), COLOR.warn);
  warnDevice(values.get(SAVE_KEY.uid));
  if (!plan.isYes) return print(TEXT.howToGo(goLine(plan)), COLOR.hint);
  print(TEXT.localKept(await backupLocal(login, BACKUP_TEXT.beforeBackupRestore)), COLOR.hint);
  if (backup.kind === BACKUP_KIND.local && backup.data) gameSave.saveReplace(backup.data);
  else gameSave.saveApply(backup.text ?? '');
  print(TEXT.restoredBackup(String(number), values.size), COLOR.ok);
  const { status } = await uploadSaveText(gameSave.saveText(true));
  print(TEXT.uploaded(login, status), status === STATUS.ok ? COLOR.ok : COLOR.error);
  return print(TEXT.reload, COLOR.hint);
}

function restore(args: readonly string[]): Promise<void> | void {
  const plan = planOf(args);
  const login = gameSave.loginParams().login;
  if (!login) {
    print(SHARED_TEXT.noLogin, COLOR.notice);
    return;
  }
  return (plan.backup === null ? restoreOnline(login, plan) : restoreBackup(login, plan, plan.backup))
    .catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

function backups(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(TEXT.backupsUsage);
  return listBackups()
    .then((list) => {
      if (!list.length) return print(TEXT.backupsNone, COLOR.notice);
      print(TEXT.backupsTitle(list.length), COLOR.title);
      list.forEach((entry, index) => { print(TEXT.backupRow(String(index + 1), agoText(Date.now() - entry.at), entry.kind, entry.login, entry.reason, entry.values)); });
      return undefined;
    })
    .catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

export const restoreCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.restore,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: restore,
});

export const backupsCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.backups,
  usage: TEXT.backupsUsage,
  desc: TEXT.backupsDesc,
  help: { about: TEXT.backupsAbout },
  run: backups,
});
