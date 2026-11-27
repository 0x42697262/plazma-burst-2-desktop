import { FEATURE } from '#shared/features/keys.ts';
import type { ServerFeature, ServerFeatureContext, ServerRuntime } from '#server/feature-types.ts';
import type { ChatMessage, Match } from '#server/game.ts';
import { CHAT_COMMAND, MAPS_COMMAND, TARGET_KIND } from './keys.ts';
import { TEXT } from './text.ts';
import { chatRequest, terminalRequest } from './domain/request.ts';
import { matchesToReload, updateMap, type UpdatePorts, type UpdateReport } from './services/update-map.ts';

const portsOf = (runtime: ServerRuntime): UpdatePorts<Match> => ({
  update: (id) => runtime.maps.update(id),
  reload: (match) => runtime.game.reloadMatch(match),
  tell: (match, text) => { runtime.game.sayToMatch(match, text); },
});

const reportLines = (report: UpdateReport): string[] => [
  report.reloaded.length ? TEXT.reloaded(report.id, report.reloaded) : TEXT.updated(report.id),
  ...report.failed.map((entry) => TEXT.reloadFailed(entry.title, entry.message)),
];

function runTerminal(context: ServerFeatureContext, runtime: ServerRuntime, rest: string): void {
  const request = terminalRequest(rest);
  if (!request) throw new Error(TEXT.usage);
  if (!context.config.download_maps) throw new Error(TEXT.noDownloads);
  const findMatch = (word: string): Match => runtime.game.match(word);
  const id = request.target.kind === TARGET_KIND.match ? findMatch(request.target.word).map_id : request.target.id;
  const toReload = matchesToReload(request.target, request.now, runtime.game.matches(), findMatch);
  context.log.info(TEXT.started(id));
  void updateMap(portsOf(runtime), id, toReload, TEXT.terminalNotice).then(
    (report) => { for (const line of reportLines(report)) context.log.info(line); },
    (error: unknown) => { context.log.warn(TEXT.failed(id, (error as Error).message)); },
  );
}

function onChat(context: ServerFeatureContext, runtime: ServerRuntime, message: ChatMessage): void {
  const request = chatRequest(message.text);
  if (!request || !message.isStaff) return;
  const reply = (text: string): void => { runtime.game.sayTo(message.connection, text); };
  const match = message.match;
  if (!match) {
    reply(TEXT.chatOutsideMatch(CHAT_COMMAND));
    return;
  }
  if (!context.config.download_maps) {
    reply(TEXT.noDownloads);
    return;
  }
  const id = match.map_id;
  context.log.info(TEXT.chatLog(message.nickname, id, request.now));
  if (!request.now) reply(TEXT.chatStarted(id));
  void updateMap(portsOf(runtime), id, request.now ? [match] : [], TEXT.chatNotice(message.nickname)).then(
    (report) => {
      for (const line of reportLines(report)) context.log.info(line);
      for (const entry of report.failed) reply(TEXT.reloadFailed(entry.title, entry.message));
      if (!request.now) reply(TEXT.chatUpdated(id, CHAT_COMMAND));
    },
    (error: unknown) => {
      context.log.warn(TEXT.failed(id, (error as Error).message));
      reply(TEXT.chatFailed(id, (error as Error).message));
    },
  );
}

export const mapUpdateServer: ServerFeature = Object.freeze({
  id: FEATURE.mapUpdate,
  commands: (context: ServerFeatureContext, runtime: ServerRuntime) => ({ [MAPS_COMMAND]: { help: TEXT.help, run: (rest: string) => { runTerminal(context, runtime, rest); } } }),
  chat: (context: ServerFeatureContext, runtime: ServerRuntime) => (message: ChatMessage) => { onChat(context, runtime, message); },
});
