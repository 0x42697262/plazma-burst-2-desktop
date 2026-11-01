import { PAGE_REPORT_TAG, REPORT_LEVEL, type ReportLevel } from './keys.ts';
import { TEXT } from './text.ts';

export type ReportSink = (message: string, level: ReportLevel) => void;

const toPageConsole: ReportSink = (message, level) => {
  const line = TEXT.terminalLine(PAGE_REPORT_TAG, message);
  if (level === REPORT_LEVEL.error) console.error(line);
  else if (level === REPORT_LEVEL.warn) console.warn(line);
  else console.log(line);
};

let sink: ReportSink = toPageConsole;

export const showReportsIn = (consoleSink: ReportSink): void => { sink = consoleSink; };

export const report = (message: string, level: ReportLevel): void => { sink(message, level); };
