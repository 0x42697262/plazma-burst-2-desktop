import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { FETCH_FINGERPRINT_WORD, OPERATION } from '../keys.ts';
import { COMMAND_TEXT } from '../text.ts';
import type { ListedServer } from '../domain/command-words.ts';
import { askServerList } from '../adapters/route-client.ts';

type SaveAnswer = { errors?: string[]; server?: ListedServer & { hasPassword: boolean } };
export type CommandContext = { rest: string };

export async function saveServer(entry: Record<string, string>, what: string): Promise<void> {
  if (entry.fingerprint?.toLowerCase() === FETCH_FINGERPRINT_WORD) {
    if (!entry.address) throw new Error(COMMAND_TEXT.fetchNeedsAddress);
    entry.fingerprint = await askServerList<string>(OPERATION.fingerprint, entry.address);
    print(COMMAND_TEXT.fetchedFingerprint(entry.fingerprint), COLOR.warn);
  }
  const answer = await askServerList<SaveAnswer>(OPERATION.save, entry);
  if (answer.errors) {
    for (const error of answer.errors) print(COMMAND_TEXT.errorLine(error), COLOR.error);
    return;
  }
  const saved = answer.server;
  if (saved) print(COMMAND_TEXT.saved(what, saved.name, saved.address, saved.nickname ?? '', saved.hasPassword), COLOR.ok);
}

export const reportingErrors = (action: (args: readonly string[], context: CommandContext) => Promise<void>) => (args: readonly string[], context: CommandContext): void => {
  action(args, context).catch((error: unknown) => print(COMMAND_TEXT.errorLine((error as Error).message), COLOR.error));
};
