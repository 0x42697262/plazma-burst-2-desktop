import { print } from '#console/kernel/ui/log.ts';
import { showPaged, takePage } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import { CORE_SETTING } from '#console/kernel/state/keys.ts';
import { COMMAND, DIRECTION, LINE_BREAK, LINE_KIND, RUN_NUMBER } from '../../keys.ts';
import { parseFilter, type LineFilter } from '../../domain/filter.ts';
import { parseLine, type ParsedLine } from '../../domain/line.ts';
import { readRun } from '../../adapters/wrapper-client.ts';
import { effectiveSetting, recorder } from '../../services/page-recorder.ts';
import { listedRun, listedRunCount } from '../../services/run-list.ts';
import { SHOW_COMMAND } from './keys.ts';
import { SHOW_TEXT as TEXT } from './text.ts';

type Row = [string, string];

const KIND_COLOR: Readonly<Record<string, string>> = Object.freeze({
  [LINE_KIND.loss]: COLOR.warn, [LINE_KIND.stat]: COLOR.hint, [LINE_KIND.conn]: COLOR.notice,
  [LINE_KIND.page]: COLOR.notice, [LINE_KIND.state]: COLOR.muted, [LINE_KIND.packet]: COLOR.muted,
});

function colorOf(parsed: ParsedLine | null): string {
  const kindColor = parsed ? KIND_COLOR[parsed.kind] : undefined;
  if (kindColor) return kindColor;
  return parsed?.dir === DIRECTION.in ? COLOR.bright : COLOR.plain;
}

function showLines(lines: readonly string[], options: { title: string; filter: LineFilter; page: number | null; source: string }): void {
  const { title, filter, page, source } = options;
  const picked = lines.slice(-filter.last).filter(filter.test);
  const rows: Row[] = picked.map((line) => [line, colorOf(parseLine(line))]);
  const pages = Math.max(1, Math.ceil(rows.length / (effectiveSetting(CORE_SETTING.pageSize) as number)));
  showPaged({
    title: filter.filtered ? TEXT.matched(title, picked.length, Math.min(lines.length, filter.last)) : TEXT.total(title, picked.length),
    rows,
    cmd: TEXT.pageCommand,
    empty: filter.filtered ? TEXT.nothingMatches : TEXT.nothingRecorded,
    hint: source,
    page: page === null ? pages : page,
  });
}

function resolveRun(word: string): string {
  if (!RUN_NUMBER.test(word)) return word;
  const listed = listedRun(Number(word));
  if (!listed) throw new Error(TEXT.noRunNumber(word, listedRunCount()));
  return listed.name;
}

function show(args: readonly string[]): void {
  const { args: rest, page } = takePage(args);
  const filter = parseFilter(rest);
  const pageNumber = rest.length === args.length ? null : page;
  if (!filter.run) {
    showLines(recorder.lines(), { title: TEXT.thisPageTitle, filter, page: pageNumber, source: TEXT.thisPageSource(recorder.file()) });
    return;
  }
  if (REMOTE) throw new Error(TEXT.remoteRun);
  const name = resolveRun(filter.run);
  readRun(name, filter.last)
    .then((text) => showLines(text ? text.split(LINE_BREAK) : [], { title: TEXT.runTitle(name), filter, page: pageNumber, source: TEXT.runSource(name) }))
    .catch((error: unknown) => print(TEXT.readFailed(name, (error as Error).message), COLOR.error));
}

export const showCommand = Object.freeze({
  parent: COMMAND.name,
  name: SHOW_COMMAND.name,
  aliases: SHOW_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, args: TEXT.args(REMOTE), examples: TEXT.examples(REMOTE), see: TEXT.see },
  run: show,
});
