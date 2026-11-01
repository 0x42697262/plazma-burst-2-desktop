import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '#console/kernel/core/keys.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { agoText } from '#console/kernel/core/words.ts';
import { CHARS_WIDTH, DATE_CHARS, KEY_WIDTH, KIND_WIDTH, LABEL_WIDTH, SEEN_WIDTH } from '../constants.ts';
import { COMMAND, UNKNOWN_LABEL } from '../keys.ts';
import { COMMAND_TEXT } from '../text.ts';
import { codePointOf, jsonObject, labelOf, replyOf, splitReply } from '../domain/reply.ts';
import { runFingerprinter } from '../adapters/runner.ts';
import { latestFingerprint, listFingerprints } from '../adapters/wrapper-client.ts';

export type FingerprintCommandDeps = { buildTag: () => string; timeZone: () => string | null };

const ago = (time: string): string => agoText(Date.now() - Date.parse(time));
const shownValue = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

function showReply(parts: readonly string[], tag: string, isRaw: boolean, code: string, timeZone: string | null): void {
  const { values, separator } = splitReply(parts, code);
  print(COMMAND_TEXT.answerTitle(parts.length, separator === null ? null : values.length, separator, separator === null ? '' : codePointOf(separator)), COLOR.title);
  if (isRaw) {
    parts.forEach((text, index) => print(COMMAND_TEXT.rawPart(index, text), COLOR.plain));
    return;
  }
  values.forEach((text, index) => {
    const label = labelOf(text, tag, code, timeZone);
    const object = jsonObject(text);
    if (!object) {
      print(COMMAND_TEXT.valueLine(index, label.padEnd(LABEL_WIDTH), text), label === UNKNOWN_LABEL ? COLOR.notice : COLOR.plain);
      return;
    }
    print(COMMAND_TEXT.objectTitle(index, label), COLOR.bright);
    for (const [key, value] of Object.entries(object)) print(COMMAND_TEXT.objectEntry(key.padEnd(KEY_WIDTH), shownValue(value)), COLOR.plain);
  });
}

export function createFingerprintCommand(deps: FingerprintCommandDeps) {
  async function runLatest(isRaw: boolean): Promise<void> {
    const fingerprint = await latestFingerprint();
    if (!fingerprint) {
      print(COMMAND_TEXT.noneSaved, COLOR.notice);
      return;
    }
    const tag = deps.buildTag();
    print(COMMAND_TEXT.header(fingerprint.id, fingerprint.file, fingerprint.kind, fingerprint.chars, fingerprint.seen, fingerprint.last ? ago(fingerprint.last) : '', fingerprint.versions), COLOR.hint);
    const parts = replyOf(await runFingerprinter(fingerprint, tag));
    if (!parts) {
      print(COMMAND_TEXT.noAnswer, COLOR.warn);
      return;
    }
    showReply(parts, tag, isRaw, fingerprint.code, deps.timeZone());
    if (!isRaw) print(COMMAND_TEXT.footnote, COLOR.hint);
  }

  function run(args: readonly string[]): Promise<void> {
    const { options, rest } = takeOptions(args, [COMMAND.raw]) as { options: Set<string>; rest: string[] };
    if (rest.length) throw new Error(COMMAND_TEXT.usageError);
    return runLatest(options.has(COMMAND.raw)).catch((error: unknown) => print(COMMAND_TEXT.runFailed((error as Error).message), COLOR.error));
  }

  function list(args: readonly string[]): Promise<void> {
    if (args.length) throw new Error(COMMAND_TEXT.listUsageError);
    return listFingerprints()
      .then((versions) => {
        if (!versions.length) {
          print(COMMAND_TEXT.list.none, COLOR.notice);
          return;
        }
        print(COMMAND_TEXT.list.title(versions.length), COLOR.title);
        for (const version of versions) {
          print(COMMAND_TEXT.list.row(
            version.id, version.latest ? COMMAND_TEXT.list.latestMark : COMMAND_TEXT.list.notLatestMark, version.kind.padEnd(KIND_WIDTH),
            String(version.chars).padStart(CHARS_WIDTH), String(version.seen).padStart(SEEN_WIDTH), version.first.slice(0, DATE_CHARS),
            version.last ? ago(version.last) : '', version.file,
          ), version.latest ? COLOR.ok : COLOR.plain);
        }
      })
      .catch((error: unknown) => print(COMMAND_TEXT.list.failed((error as Error).message), COLOR.error));
  }

  return Object.freeze({
    name: COMMAND.name,
    aliases: COMMAND.aliases,
    remote: false,
    usage: COMMAND_TEXT.usage,
    desc: COMMAND_TEXT.description,
    help: { about: COMMAND_TEXT.about, args: COMMAND_TEXT.args, examples: COMMAND_TEXT.examples, notes: COMMAND_TEXT.notes },
    run,
    subcommands: [
      {
        name: COMMAND.list,
        aliases: COMMAND.listAliases,
        usage: COMMAND_TEXT.list.usage,
        desc: COMMAND_TEXT.list.description,
        help: { about: COMMAND_TEXT.list.about, see: COMMAND_TEXT.list.see },
        run: list,
      },
    ],
  });
}
