import { game } from '#console/kernel/game/bindings.ts';
import { ANSWER_TIMEOUT_MS } from '../constants.ts';
import { LIST_FILTER, LIST_MESSAGE } from '../keys.ts';
import { LOBBY_TEXT as TEXT } from '../text.ts';
import { listReplyOf, type ListReply } from '../domain/reply.ts';

type LobbyBindings = Readonly<{
  replyTo(): unknown;
  sendLobby(typeName: string, parts: readonly unknown[], reply?: unknown): void;
}>;

const bind = game as unknown as LobbyBindings;

export function askList(view: string): Promise<ListReply> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error(TEXT.noAnswer)); }, ANSWER_TIMEOUT_MS);
    const answered = (reply: unknown): void => {
      clearTimeout(timer);
      const read = listReplyOf(reply);
      if (read.ok) resolve(read);
      else reject(new Error(TEXT.refused(read.reason)));
    };
    try {
      bind.sendLobby(LIST_MESSAGE, [LIST_FILTER, bind.replyTo(), view], answered);
    } catch (error) {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
