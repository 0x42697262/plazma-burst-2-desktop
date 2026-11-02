import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { agoText } from '#console/kernel/core/words.ts';
import { CHARS_WIDTH, DATE_CHARS, KIND_WIDTH, SEEN_WIDTH } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { listFingerprints } from '../../adapters/wrapper-client.ts';
import { LIST_COMMAND } from './keys.ts';
import { LIST_TEXT as TEXT } from './text.ts';

const ago = (time: string): string => agoText(Date.now() - Date.parse(time));

function list(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(TEXT.usageError);
  return listFingerprints()
    .then((versions) => {
      if (!versions.length) {
        print(TEXT.none, COLOR.notice);
        return;
      }
      print(TEXT.title(versions.length), COLOR.title);
      for (const version of versions) {
        print(TEXT.row(
          version.id, version.latest ? TEXT.latestMark : TEXT.notLatestMark, version.kind.padEnd(KIND_WIDTH),
          String(version.chars).padStart(CHARS_WIDTH), String(version.seen).padStart(SEEN_WIDTH), version.first.slice(0, DATE_CHARS),
          version.last ? ago(version.last) : '', version.file,
        ), version.latest ? COLOR.ok : COLOR.plain);
      }
    })
    .catch((error: unknown) => print(TEXT.failed((error as Error).message), COLOR.error));
}

export const listCommand = Object.freeze({
  parent: COMMAND.name,
  name: LIST_COMMAND.name,
  aliases: LIST_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, examples: TEXT.examples, see: TEXT.see },
  run: list,
});
