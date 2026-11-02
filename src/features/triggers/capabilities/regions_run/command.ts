import { findRegion } from '../../model.ts';
import { fireRegion } from '../../regions.ts';
import { takeRunOptions } from '../../run.ts';
import { REGIONS_COMMAND, SPACE } from '../../entry/keys.ts';
import { TEXT } from './text.ts';
import { regionsOrNone } from '../../region-list.ts';
import { COMMAND } from './keys.ts';

function runRegion(args: readonly string[]): void {
  const list = regionsOrNone();
  const { rest, force, activator } = takeRunOptions(args, TEXT.runUsage);
  if (!rest.length) throw new Error(TEXT.runUsage);
  const query = rest.join(SPACE);
  const index = findRegion(query);
  if (index < 0 || !list[index]) throw new Error(TEXT.noRegion(query));
  fireRegion(index, { force, activator });
}

export const regionsRunCommand = Object.freeze({
  parent: REGIONS_COMMAND.name,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: TEXT.run.usage,
  desc: TEXT.run.desc,
  reportsReach: true,
  help: { about: TEXT.run.about, args: TEXT.run.args, examples: TEXT.run.examples, notes: TEXT.run.notes, see: TEXT.run.see },
  run: (args: string[]) => { runRegion(args); },
});
