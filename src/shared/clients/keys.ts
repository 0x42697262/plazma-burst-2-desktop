import { CLIENT, type ClientId } from '#shared/features/keys.ts';

export type ClientDetails = Readonly<{
  id: ClientId;
  title: string;
  host: string;
  site: string;
  gamePrefix: (version: string | null) => string;
  settingsFileName: string;
  partition: string | null;
  editorScript: string | null;
  fetchFlag: string;
  runFlag: string;
}>;

export const SADBURST_FLAG = '--sadburst';
export const OFFICIAL_LOBBY = Object.freeze({ host: 'vvvv.plazmaburst2.com', port: 2053 });

export const CLIENT_DETAILS: Readonly<Record<ClientId, ClientDetails>> = Object.freeze({
  [CLIENT.official]: Object.freeze({
    id: CLIENT.official,
    title: 'Plazma Burst 2',
    host: 'www.plazmaburst2.com',
    site: 'https://www.plazmaburst2.com',
    gamePrefix: (version: string | null) => `/h5/versions/${version ?? ''}/`,
    settingsFileName: 'dev-overrides.json',
    partition: null,
    editorScript: null,
    fetchFlag: '',
    runFlag: '',
  }),
  [CLIENT.sadburst]: Object.freeze({
    id: CLIENT.sadburst,
    title: 'Sad Burst 2',
    host: 'sadburst2.com',
    site: 'https://sadburst2.com',
    gamePrefix: () => '/gameplay/',
    settingsFileName: 'dev-overrides.sadburst.json',
    partition: 'persist:sadburst',
    editorScript: 'https://sadburst2.com/map_editor/scripts/ale/ale-all.js',
    fetchFlag: ' --sadburst',
    runFlag: ' -- --sadburst',
  }),
});
