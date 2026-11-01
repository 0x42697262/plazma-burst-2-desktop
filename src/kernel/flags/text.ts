import { REPORT_COLUMN } from './constants.ts';

export const TEXT = Object.freeze({
  unknownFeature: (id: string, where: string) => `${where}: no feature "${id}" (see "npm start -- --features")`,
  locked: (id: string, where: string) => `${where}: "${id}" cannot be turned off`,
  notInEdition: (id: string, where: string, edition: string) => `${where}: "${id}" is not in this app (edition "${edition}")`,
  notInEditionReason: 'not in this app',
  notAvailableInMode: (mode: string) => `not available in ${mode} mode`,
  notForClient: (client: string) => `not available for the ${client} client`,
  needs: (required: string) => `needs ${required}`,
  sourceFile: 'features.json',
  sourceEnv: 'PB2_FEATURES',
  on: 'on',
  off: 'off',
  reportLine: (id: string, state: string, source: string, reason: string | null, description: string) => `${id.padEnd(REPORT_COLUMN.id)}${state.padEnd(REPORT_COLUMN.state)}${source.padEnd(REPORT_COLUMN.source)}${description}${reason ? ` (${reason})` : ''}`,
  reportHeader: `${'feature'.padEnd(REPORT_COLUMN.id)}${'state'.padEnd(REPORT_COLUMN.state)}${'source'.padEnd(REPORT_COLUMN.source)}description`,
  stateWithSource: (state: string, source: string) => `${state}:${source}`,
});
