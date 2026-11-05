export const WRAPPER_TEXT = Object.freeze({
  saved: (kind: string, message: string) => `Diagnostics: saved a ${kind} report: ${message}`,
  unreadable: (message: string) => `Diagnostics: could not read the reports: ${message}`,
  notSaved: (message: string) => `Diagnostics: could not save a report: ${message}`,
  rendererGone: (reason: string, exitCode: number) => `The game page's process ended: ${reason} (exit code ${exitCode})`,
  configProblem: (problem: string) => `Diagnostics: ${problem}`,
  sent: (count: number, host: string) => `Diagnostics: sent ${count} report${count === 1 ? '' : 's'} to ${host}`,
  sendFailed: (message: string) => `Diagnostics: not sent: ${message}`,
  rendererName: 'RendererGone',
  rejectionName: 'UnhandledRejection',
  manualName: 'Manual',
  manualMessage: 'Report asked for in the console',
});

export const ROUTE_TEXT = Object.freeze({
  notHere: 'not available in this window',
  unknownOperation: 'unknown op',
  invalid: 'invalid request',
  noReport: 'no such report',
  capabilityOff: 'not in this app',
});

export const CONFIG_TEXT = Object.freeze({
  badHost: (host: string) => `the server "${host}" is not an https:// address (http:// only for this machine); nothing is sent`,
  badFields: (fields: readonly string[]) => `unknown fields to send: ${fields.join(', ')}`,
  badFile: (message: string) => `the settings file was not used: ${message}`,
  httpStatus: (status: number) => `the server answered ${status}`,
});
