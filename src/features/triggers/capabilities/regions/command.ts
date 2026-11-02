import { CAPABILITY } from '#shared/features/keys.ts';
import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { requireLevel } from '#console/kernel/game/level.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import type { CommandDefinition } from '#console/kernel/commands/registry.ts';
import { regionList, triggerList, regionModeName, regionUid, timerUid, findRegion, REGION_MODE } from '../../model.ts';
import { fireRegion } from '../../regions.ts';
import { takeRunOptions } from '../../run.ts';
import { NO_TARGET } from '../../keys.ts';
import { INDEX_WIDTH, REGION_MODE_WIDTH, REGION_UID_WIDTH } from '../../entry/constants.ts';
import { NO_UID, REGIONS_COMMAND, SPACE } from '../../entry/keys.ts';
import { REGIONS_TEXT as TEXT } from '../../entry/text.ts';

type Region = Record<string, unknown> & { x?: number; y?: number };

function firesText(region: Region): string {
  const target = region[GAME_FIELDS.R_TRIGGER];
  if (typeof target !== 'number' || target === NO_TARGET) return TEXT.nothing;
  if (region[GAME_FIELDS.R_USES_TIMER]) return TEXT.firesTimer(target, timerUid(target));
  return TEXT.firesTrigger(target, triggerList()[target]?.uid);
}

function regionsOrNone(): (Region | null | undefined)[] {
  requireLevel();
  const list = regionList();
  if (!list.length) throw new Error(TEXT.noRegions);
  return list;
}

function listRegions(rawArgs: readonly string[]): void {
  const list = regionsOrNone();
  const { args, page } = takePage(rawArgs);
  const filter = args.join(SPACE).trim().toLowerCase();
  const rows: Row[] = [];
  list.forEach((region, index) => {
    if (!region) return;
    const uid = regionUid(index) || NO_UID;
    if (filter && !uid.toLowerCase().includes(filter)) return;
    const mode = region[GAME_FIELDS.R_USE_ON];
    const text = TEXT.row(String(index).padEnd(INDEX_WIDTH), uid.padEnd(REGION_UID_WIDTH), regionModeName(mode).padEnd(REGION_MODE_WIDTH), firesText(region), Math.round(region.x as number), Math.round(region.y as number));
    rows.push([text, mode === REGION_MODE.NEVER ? COLOR.muted : undefined]);
  });
  showPaged({ title: TEXT.title(list.length, filter, rows.length), rows, cmd: TEXT.command(filter), empty: TEXT.empty(filter), page });
}

function runRegion(args: readonly string[]): void {
  const list = regionsOrNone();
  const { rest, force, activator } = takeRunOptions(args, TEXT.runUsage);
  if (!rest.length) throw new Error(TEXT.runUsage);
  const query = rest.join(SPACE);
  const index = findRegion(query);
  if (index < 0 || !list[index]) throw new Error(TEXT.noRegion(query));
  fireRegion(index, { force, activator });
}

export const regionsCommand: CommandDefinition = {
  name: REGIONS_COMMAND.name,
  capability: CAPABILITY.triggers.regions,
  aliases: REGIONS_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: TEXT.help,
  run: (args) => { listRegions(args); },
  subcommands: [
    {
      name: REGIONS_COMMAND.run,
      capability: CAPABILITY.triggers.regionsRun,
      aliases: REGIONS_COMMAND.runAliases,
      usage: TEXT.run.usage,
      desc: TEXT.run.desc,
      reportsReach: true,
      help: { about: TEXT.run.about, args: TEXT.run.args, examples: TEXT.run.examples, notes: TEXT.run.notes, see: TEXT.run.see },
      run: (args) => { runRegion(args); },
    },
  ],
};
