export const WRAPPER_TEXT = Object.freeze({
  saved: (kind: string, message: string) => `Diagnostics: saved a ${kind} report: ${message}`,
  unreadable: (message: string) => `Diagnostics: could not read the reports: ${message}`,
  notSaved: (message: string) => `Diagnostics: could not save a report: ${message}`,
  rendererGone: (reason: string, exitCode: number) => `The game page's process ended: ${reason} (exit code ${exitCode})`,
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
