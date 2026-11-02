export const REPORT_LEVEL = Object.freeze({ note: 'note', warn: 'warn', error: 'error' });
export type ReportLevel = typeof REPORT_LEVEL[keyof typeof REPORT_LEVEL];

export const PAGE_REPORT_TAG = '[pb2]';
export const PAGE_JOIN_GLOBAL = 'PB2_JOIN';
