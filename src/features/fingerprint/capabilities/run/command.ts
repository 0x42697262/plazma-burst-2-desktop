import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { agoText } from '#console/kernel/core/words.ts';
import { gameNetwork } from '#console/kernel/game/network.ts';
import { KEY_WIDTH, LABEL_WIDTH } from '../../constants.ts';
import { COMMAND, UNKNOWN_LABEL } from '../../keys.ts';
import { codePointOf, jsonObject, labelOf, replyOf, splitReply } from '../../domain/reply.ts';
import { latestFingerprint } from '../../adapters/wrapper-client.ts';
import { runFingerprinter } from './runner.ts';
import { RUN_TEXT as TEXT } from './text.ts';

const ago = (time: string): string => agoText(Date.now() - Date.parse(time));
const shownValue = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

const localTimeZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

function showReply(parts: readonly string[], tag: string, isRaw: boolean, code: string, timeZone: string | null): void {
  const { values, separator } = splitReply(parts, code);
  print(TEXT.answerTitle(parts.length, separator === null ? null : values.length, separator, separator === null ? '' : codePointOf(separator)), COLOR.title);
  if (isRaw) {
    parts.forEach((text, index) => print(TEXT.rawPart(index, text), COLOR.plain));
    return;
  }
  values.forEach((text, index) => {
    const label = labelOf(text, tag, code, timeZone);
    const object = jsonObject(text);
    if (!object) {
      print(TEXT.valueLine(index, label.padEnd(LABEL_WIDTH), text), label === UNKNOWN_LABEL ? COLOR.notice : COLOR.plain);
      return;
    }
    print(TEXT.objectTitle(index, label), COLOR.bright);
    for (const [key, value] of Object.entries(object)) print(TEXT.objectEntry(key.padEnd(KEY_WIDTH), shownValue(value)), COLOR.plain);
  });
}

async function runLatest(isRaw: boolean): Promise<void> {
  const fingerprint = await latestFingerprint();
  if (!fingerprint) {
    print(TEXT.noneSaved, COLOR.notice);
    return;
  }
  const tag = gameNetwork.buildTag();
  print(TEXT.header(fingerprint.id, fingerprint.file, fingerprint.kind, fingerprint.chars, fingerprint.seen, fingerprint.last ? ago(fingerprint.last) : '', fingerprint.versions), COLOR.hint);
  const parts = replyOf(await runFingerprinter(fingerprint, tag));
  if (!parts) {
    print(TEXT.noAnswer, COLOR.warn);
    return;
  }
  showReply(parts, tag, isRaw, fingerprint.code, localTimeZone());
  if (!isRaw) print(TEXT.footnote, COLOR.hint);
}

function run(args: readonly string[]): Promise<void> {
  const { options, rest } = takeOptions(args, [COMMAND.raw]) as { options: Set<string>; rest: string[] };
  if (rest.length) throw new Error(TEXT.usageError);
  return runLatest(options.has(COMMAND.raw)).catch((error: unknown) => print(TEXT.runFailed((error as Error).message), COLOR.error));
}

export const runCommand = Object.freeze({
  parent: COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, notes: TEXT.notes },
  run,
});
