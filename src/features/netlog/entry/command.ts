import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { showPaged, takePage } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { agoText } from '#console/kernel/core/words.ts';
import { CONNECTION_KIND_COLUMN_WIDTH, KILOBYTE, RUN_INDEX_WIDTH, RUN_NAME_COLUMN_WIDTH, RUN_OWNER_COLUMN_WIDTH, RUN_SIZE_COLUMN_WIDTH, SIZE_DECIMALS } from '../constants.ts';
import { COMMAND, SETTING_NAME, type SettingName, DIRECTION, LINE_BREAK, LINE_KIND, OFF_WORD, ON_WORD, RUN_NUMBER } from '../keys.ts';
import { COMMAND_TEXT } from '../text.ts';
import { parseFilter, type LineFilter } from '../domain/filter.ts';
import { lossText } from '../domain/loss.ts';
import { parseLine, type ParsedLine } from '../domain/line.ts';
import { listRuns, readRun, type RunEntry } from '../adapters/wrapper-client.ts';
import type { Recorder } from '../services/recorder.ts';

export type NetlogCommandDeps = {
  recorder: Recorder;
  remote: boolean;
  pageSize(): number;
  everythingOn(): boolean;
  statesOn(): boolean;
  setKey(key: SettingName, words: readonly string[]): void;
};

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

function pageOf(args: readonly string[]): { args: string[]; page: number } {
  const taken = takePage(args);
  return { args: taken.args, page: taken.page };
}

const usage = (text: string): Error => new Error(COMMAND_TEXT.usageError(text));
const withoutArguments = (args: readonly string[], text: string): void => { if (args.length) throw usage(text); };

export function createNetlogCommand(deps: NetlogCommandDeps) {
  const { recorder, remote } = deps;
  let lastRuns: RunEntry[] = [];

  function showLines(lines: readonly string[], options: { title: string; filter: LineFilter; page: number | null; source: string }): void {
    const { title, filter, page, source } = options;
    const picked = lines.slice(-filter.last).filter(filter.test);
    const rows: Row[] = picked.map((line) => [line, colorOf(parseLine(line))]);
    const pages = Math.max(1, Math.ceil(rows.length / deps.pageSize()));
    showPaged({
      title: filter.filtered ? COMMAND_TEXT.show.matched(title, picked.length, Math.min(lines.length, filter.last)) : COMMAND_TEXT.show.total(title, picked.length),
      rows,
      cmd: COMMAND_TEXT.show.pageCommand,
      empty: filter.filtered ? COMMAND_TEXT.show.nothingMatches : COMMAND_TEXT.show.nothingRecorded,
      hint: source,
      page: page === null ? pages : page,
    });
  }

  function resolveRun(word: string): string {
    if (!RUN_NUMBER.test(word)) return word;
    const listed = lastRuns[Number(word) - 1];
    if (!listed) throw new Error(COMMAND_TEXT.show.noRunNumber(word, lastRuns.length));
    return listed.name;
  }

  function show(args: readonly string[]): void {
    const { args: rest, page } = pageOf(args);
    const filter = parseFilter(rest);
    const pageNumber = rest.length === args.length ? null : page;
    if (!filter.run) {
      showLines(recorder.lines(), { title: COMMAND_TEXT.show.thisPageTitle, filter, page: pageNumber, source: COMMAND_TEXT.show.thisPageSource(recorder.file()) });
      return;
    }
    if (remote) throw new Error(COMMAND_TEXT.show.remoteRun);
    const name = resolveRun(filter.run);
    readRun(name, filter.last)
      .then((text) => showLines(text ? text.split(LINE_BREAK) : [], { title: COMMAND_TEXT.show.runTitle(name), filter, page: pageNumber, source: COMMAND_TEXT.show.runSource(name) }))
      .catch((error: unknown) => print(COMMAND_TEXT.show.readFailed(name, (error as Error).message), COLOR.error));
  }

  function ownerOf(entry: RunEntry): string {
    if (entry.current) return COMMAND_TEXT.runs.owner.current;
    if (entry.mine) return COMMAND_TEXT.runs.owner.mine;
    return entry.active ? COMMAND_TEXT.runs.owner.active : COMMAND_TEXT.runs.owner.ended;
  }

  function colorOfRun(entry: RunEntry): string {
    if (entry.current) return COLOR.ok;
    return entry.mine || entry.active ? COLOR.plain : COLOR.muted;
  }

  function printRuns(list: RunEntry[]): void {
    lastRuns = list;
    if (!list.length) {
      print(COMMAND_TEXT.runs.none, COLOR.notice);
      return;
    }
    const now = Date.now();
    print(COMMAND_TEXT.runs.title(list.length), COLOR.title);
    list.forEach((entry, index) => {
      const size = COMMAND_TEXT.runs.size((entry.size / KILOBYTE).toFixed(SIZE_DECIMALS));
      print(COMMAND_TEXT.runs.row(
        String(index + 1).padStart(RUN_INDEX_WIDTH), entry.name.padEnd(RUN_NAME_COLUMN_WIDTH), ownerOf(entry).padEnd(RUN_OWNER_COLUMN_WIDTH),
        size.padStart(RUN_SIZE_COLUMN_WIDTH), agoText(now - entry.updated),
      ), colorOfRun(entry));
    });
  }

  function runs(args: readonly string[]): void {
    withoutArguments(args, COMMAND_TEXT.runs.usage);
    listRuns().then(printRuns).catch(() => print(COMMAND_TEXT.runs.listFailed, COLOR.error));
  }

  function status(args: readonly string[]): void {
    withoutArguments(args, COMMAND_TEXT.usage);
    const isOn = recorder.on();
    const isEverythingOn = deps.everythingOn();
    const areStatesWritten = isEverythingOn || deps.statesOn();
    print(COMMAND_TEXT.status.header(isOn, isEverythingOn, areStatesWritten), isOn ? COLOR.ok : COLOR.notice);
    const writeError = recorder.writeError();
    if (writeError) print(COMMAND_TEXT.status.writeError(writeError), COLOR.error);
    else print(COMMAND_TEXT.status.file(recorder.file()), COLOR.hint);
    print(COMMAND_TEXT.status.pageLines(recorder.pageLines()), COLOR.hint);
    const connections = recorder.connections();
    if (!connections.length) print(isOn ? COMMAND_TEXT.status.noConnections : COMMAND_TEXT.status.offNothing, COLOR.hint);
    for (const connection of connections) {
      const totals = connection.total;
      const hasLoss = totals.slow || totals.stalled || totals.dropped || totals.gaps;
      print(COMMAND_TEXT.status.connection(
        connection.id, connection.kind.padEnd(CONNECTION_KIND_COLUMN_WIDTH), connection.connected, connection.ping, totals.pkOut, totals.pkIn,
        lossText(totals), connection.unacked, connection.missing,
      ), hasLoss ? COLOR.warn : COLOR.plain);
    }
    print(COMMAND_TEXT.status.footer(remote, isOn), COLOR.hint);
  }

  function everything(args: readonly string[]): void {
    if (args.length > 1) throw usage(COMMAND_TEXT.all.usage);
    if (!args.length) {
      print(COMMAND_TEXT.all.value(deps.everythingOn()));
      return;
    }
    deps.setKey(SETTING_NAME.everything, args);
  }

  return Object.freeze({
    name: COMMAND.name,
    capability: CAPABILITY.netlog.status,
    aliases: COMMAND.aliases,
    usage: COMMAND_TEXT.usage,
    desc: COMMAND_TEXT.description,
    help: { about: COMMAND_TEXT.about, examples: COMMAND_TEXT.examples(remote), notes: COMMAND_TEXT.notes, see: COMMAND_TEXT.see },
    run: status,
    subcommands: [
      {
        name: COMMAND.show,
        capability: CAPABILITY.netlog.show,
        aliases: COMMAND.showAliases,
        usage: COMMAND_TEXT.show.usage,
        desc: COMMAND_TEXT.show.description,
        help: { about: COMMAND_TEXT.show.about, args: COMMAND_TEXT.show.args(remote), examples: COMMAND_TEXT.show.examples, see: COMMAND_TEXT.show.see },
        run: show,
      },
      {
        name: COMMAND.runs,
        capability: CAPABILITY.netlog.runs,
        aliases: COMMAND.runsAliases,
        remote: false,
        usage: COMMAND_TEXT.runs.usage,
        desc: COMMAND_TEXT.runs.description,
        help: { about: COMMAND_TEXT.runs.about, see: COMMAND_TEXT.runs.see },
        run: runs,
      },
      {
        name: COMMAND.all,
        capability: CAPABILITY.netlog.all,
        aliases: COMMAND.allAliases,
        usage: COMMAND_TEXT.all.usage,
        desc: COMMAND_TEXT.all.description,
        help: { about: COMMAND_TEXT.all.about, examples: COMMAND_TEXT.all.examples, see: COMMAND_TEXT.all.see },
        run: everything,
      },
      {
        name: COMMAND.on,
        capability: CAPABILITY.netlog.record,
        usage: COMMAND_TEXT.on.usage,
        desc: COMMAND_TEXT.on.description,
        help: { about: COMMAND_TEXT.on.about, see: COMMAND_TEXT.on.see },
        run: (args: readonly string[]) => { withoutArguments(args, COMMAND_TEXT.on.usage); deps.setKey(SETTING_NAME.recording, [ON_WORD]); },
      },
      {
        name: COMMAND.off,
        capability: CAPABILITY.netlog.record,
        usage: COMMAND_TEXT.off.usage,
        desc: COMMAND_TEXT.off.description,
        help: { about: COMMAND_TEXT.off.about, see: COMMAND_TEXT.off.see },
        run: (args: readonly string[]) => { withoutArguments(args, COMMAND_TEXT.off.usage); deps.setKey(SETTING_NAME.recording, [OFF_WORD]); },
      },
    ],
  });
}
