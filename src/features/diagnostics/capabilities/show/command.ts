import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND, LAST_WORD, ROUTE_OP } from '../../keys.ts';
import { postDiagnostics, readDiagnostics, readReport } from '../../adapters/route-client.ts';
import { NOTE_JOIN, REPORT_INDENT, SHOW_WORD } from './keys.ts';
import { SHOW_TEXT as TEXT } from './text.ts';

type Summary = { time: string; kind: string; message: string };
type Status = { capture: boolean; reports: Summary[] };

const printFailure = (error: Error): void => { print(TEXT.couldNot(error.message), COLOR.error); };

function status(): Promise<void> {
  return readDiagnostics<Status>().then(({ capture, reports }) => { print(TEXT.capturing(capture, reports.length), capture ? COLOR.ok : COLOR.notice); }, printFailure);
}

function show(args: readonly string[]): Promise<void> {
  const word = args[0];
  if (word !== undefined) return readReport<unknown>(word.toLowerCase() === LAST_WORD ? LAST_WORD : word).then((report) => { print(JSON.stringify(report, null, REPORT_INDENT)); }, printFailure);
  return readDiagnostics<Status>().then(({ reports }) => {
    if (!reports.length) print(TEXT.none, COLOR.hint);
    reports.forEach((report, index) => { print(TEXT.line(index, report.time, report.kind, report.message)); });
  }, printFailure);
}

function manualReport(args: readonly string[]): Promise<void> {
  return postDiagnostics<{ saved: boolean }>({ op: ROUTE_OP.manual, note: args.join(NOTE_JOIN) }).then(({ saved }) => { print(saved ? TEXT.saved : TEXT.notSaved, saved ? COLOR.ok : COLOR.notice); }, printFailure);
}

function clear(): Promise<void> {
  return postDiagnostics<{ cleared: number }>({ op: ROUTE_OP.clear }).then(({ cleared }) => { print(TEXT.cleared(cleared), COLOR.ok); }, printFailure);
}

export const ownCommand = Object.freeze({ parent: COMMAND.name, ownRun: true, usage: COMMAND.name, desc: TEXT.statusDescription, help: { about: TEXT.statusAbout }, remote: false, run: status });
export const statusCommand = Object.freeze({ parent: COMMAND.name, name: SHOW_WORD.status, usage: TEXT.statusUsage, desc: TEXT.statusDescription, help: { about: TEXT.statusAbout }, remote: false, run: status });
export const showCommand = Object.freeze({ parent: COMMAND.name, name: SHOW_WORD.show, usage: TEXT.showUsage, desc: TEXT.showDescription, help: { about: TEXT.showAbout }, remote: false, run: show });
export const reportCommand = Object.freeze({ parent: COMMAND.name, name: SHOW_WORD.report, usage: TEXT.reportUsage, desc: TEXT.reportDescription, help: { about: TEXT.reportAbout }, remote: false, run: manualReport });
export const clearCommand = Object.freeze({ parent: COMMAND.name, name: SHOW_WORD.clear, usage: TEXT.clearUsage, desc: TEXT.clearDescription, help: { about: TEXT.clearAbout }, remote: false, run: clear });
