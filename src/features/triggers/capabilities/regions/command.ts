import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { triggerList, regionModeName, regionUid, timerUid, REGION_MODE } from '../../model.ts';
import { NO_TARGET } from '../../keys.ts';
import { INDEX_WIDTH, REGION_MODE_WIDTH, REGION_UID_WIDTH } from '../../entry/constants.ts';
import { NO_UID, REGIONS_COMMAND, SPACE } from '../../entry/keys.ts';
import { TEXT } from './text.ts';
import { regionsOrNone } from '../../region-list.ts';

type Region = Record<string, unknown> & { x?: number; y?: number };

function firesText(region: Region): string {
  const target = region[GAME_FIELDS.R_TRIGGER];
  if (typeof target !== 'number' || target === NO_TARGET) return TEXT.nothing;
  if (region[GAME_FIELDS.R_USES_TIMER]) return TEXT.firesTimer(target, timerUid(target));
  return TEXT.firesTrigger(target, triggerList()[target]?.uid);
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

export const regionsCommand = Object.freeze({
  parent: REGIONS_COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: TEXT.help,
  run: (args: string[]) => { listRegions(args); },
});
