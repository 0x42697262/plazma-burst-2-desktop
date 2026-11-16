import { CLIENT, FEATURE, type ClientId, type FeatureId } from '#shared/features/keys.ts';

export type ClientDetails = Readonly<{
  id: ClientId;
  title: string;
  host: string;
  site: string;
  gamePrefix: (version: string | null) => string;
  settingsFileName: string;
  namesFileName: string;
  partition: string | null;
  editorScript: string | null;
  fetchFlag: string;
  runFlag: string;
  flag: string;
  npmVariable: string;
  versionPrefix: string;
  bundled: boolean;
  usesOfficial: boolean;
  lobby: Readonly<{ host: string; port: number }>;
  feature: FeatureId | null;
}>;

export const SADBURST_FLAG = '--sadburst';
export const SADBURST_ERICH5_FLAG = '--sadburst-erich5';
export const OFFICIAL_LOBBY = Object.freeze({ host: 'vvvv.plazmaburst2.com', port: 2053 });
export const SADBURST_LOBBY = Object.freeze({ host: 'ca.sadburst2.com', port: 2053 });

const SADBURST_SITE = 'https://sadburst2.com';
const SADBURST_EDITOR_SCRIPT = SADBURST_SITE + '/map_editor/scripts/ale/ale-all.js';
const FLAG_PREFIX = '--';
const npmVariableOf = (flag: string): string => 'npm_config_' + flag.slice(FLAG_PREFIX.length).replaceAll('-', '_');

export const CLIENT_DETAILS: Readonly<Record<ClientId, ClientDetails>> = Object.freeze({
  [CLIENT.official]: Object.freeze({
    id: CLIENT.official,
    title: 'Plazma Burst 2',
    host: 'www.plazmaburst2.com',
    site: 'https://www.plazmaburst2.com',
    gamePrefix: (version: string | null) => `/h5/versions/${version ?? ''}/`,
    settingsFileName: 'dev-overrides.json',
    namesFileName: 'names.js',
    partition: null,
    editorScript: null,
    fetchFlag: '',
    runFlag: '',
    flag: '',
    npmVariable: '',
    versionPrefix: 'v',
    bundled: false,
    usesOfficial: true,
    lobby: OFFICIAL_LOBBY,
    feature: null,
  }),
  [CLIENT.sadburst]: Object.freeze({
    id: CLIENT.sadburst,
    title: 'Sad Burst 2',
    host: 'sadburst2.com',
    site: SADBURST_SITE,
    gamePrefix: () => '/gameplay/',
    settingsFileName: 'dev-overrides.sadburst.json',
    namesFileName: 'names.sadburst.js',
    partition: 'persist:sadburst',
    editorScript: SADBURST_EDITOR_SCRIPT,
    fetchFlag: ` ${SADBURST_FLAG}`,
    runFlag: ` -- ${SADBURST_FLAG}`,
    flag: SADBURST_FLAG,
    npmVariable: npmVariableOf(SADBURST_FLAG),
    versionPrefix: 'sadburst-',
    bundled: true,
    usesOfficial: false,
    lobby: SADBURST_LOBBY,
    feature: FEATURE.clientSadburst,
  }),
  [CLIENT.sadburstErich5]: Object.freeze({
    id: CLIENT.sadburstErich5,
    title: 'Sad Burst 2 (official servers)',
    host: 'sadburst2.com',
    site: SADBURST_SITE,
    gamePrefix: () => '/gameplay_erich5/',
    settingsFileName: 'dev-overrides.sadburst-erich5.json',
    namesFileName: 'names.sadburst-erich5.js',
    partition: 'persist:sadburst-erich5',
    editorScript: SADBURST_EDITOR_SCRIPT,
    fetchFlag: ` ${SADBURST_ERICH5_FLAG}`,
    runFlag: ` -- ${SADBURST_ERICH5_FLAG}`,
    flag: SADBURST_ERICH5_FLAG,
    npmVariable: npmVariableOf(SADBURST_ERICH5_FLAG),
    versionPrefix: 'erich5-',
    bundled: true,
    usesOfficial: true,
    lobby: OFFICIAL_LOBBY,
    feature: FEATURE.clientSadburstErich5,
  }),
});

export const CLIENT_LIST: readonly ClientDetails[] = Object.freeze(Object.values(CLIENT_DETAILS));
export const OTHER_CLIENT_LIST: readonly ClientDetails[] = Object.freeze(CLIENT_LIST.filter((details) => details.flag));
export const CLIENT_FLAGS: readonly string[] = Object.freeze(OTHER_CLIENT_LIST.map((details) => details.flag));
export const usesOfficialServers = (client: string | null): boolean => CLIENT_LIST.find((details) => details.id === client)?.usesOfficial ?? false;
export const clientOfVersion = (version: unknown): ClientId => (
  typeof version === 'string' ? OTHER_CLIENT_LIST.find((details) => version.startsWith(details.versionPrefix))?.id ?? CLIENT.official : CLIENT.official
);
