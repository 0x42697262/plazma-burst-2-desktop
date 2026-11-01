import { CATALOG } from '#shared/features/catalog.ts';
import { reportLines } from '#kernel/flags/resolve.ts';
import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { pageFlags } from '../../flags.ts';
import { FEATURES_COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function listFeatures(args: readonly string[]): void {
  if (args.length) throw new Error(TEXT.noArguments);
  const [header = '', ...rows] = reportLines(CATALOG, pageFlags());
  print(TEXT.title, COLOR.title);
  print(header, COLOR.hint);
  for (const row of rows) print(row);
}

export const featuresCommand = Object.freeze({
  name: FEATURES_COMMAND.name,
  aliases: [FEATURES_COMMAND.alias],
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about },
  remote: false,
  run: listFeatures,
});
