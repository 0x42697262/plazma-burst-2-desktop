import fs from 'node:fs';
import { CLIENT } from '#shared/features/keys.ts';
import type { GameClient } from '#kernel/config/clients.ts';
import { readGameVersion } from '#wrapper/platform/game-files.ts';
import { NAMES_VERSION } from '#wrapper/platform/keys.ts';
import { JOBS } from '#tools/fetch-game/constants.ts';
import { fetchOfficial, latestVersion } from '#tools/fetch-game/fetch-game.ts';
import { fetchSadburst } from '#tools/fetch-game/sadburst.ts';
import { run as findOfficialNames } from '#tools/find-names/run.ts';
import { run as findSadburstNames } from '#tools/find-names/sadburst.ts';
import type { GameSetupDeps } from '../services/ensure-game.ts';
import { TEXT_ENCODING } from '../keys.ts';

function namesVersion(file: string): string | null {
  try {
    return NAMES_VERSION.exec(fs.readFileSync(file, TEXT_ENCODING))?.[1] ?? null;
  } catch {
    return null;
  }
}

export type Lines = Readonly<{ say(line: string): void; note(line: string): void }>;

export function downloadsFor(client: GameClient, gameDir: string, checksForUpdates: boolean, { say, note }: Lines): GameSetupDeps {
  const isSadburst = client.id === CLIENT.sadburst;
  const localVersion = (): string | null => readGameVersion(gameDir, null);
  return Object.freeze({
    localVersion,
    latestVersion: isSadburst ? null : latestVersion,
    checksForUpdates,
    download: async (version: string | null) => (isSadburst
      ? (await fetchSadburst(client, { out: gameDir, say })).problems
      : fetchOfficial({ version: version ?? await latestVersion(), out: gameDir, jobs: JOBS, say })),
    namesMatchGame: () => namesVersion(client.names) !== null && namesVersion(client.names) === localVersion(),
    findNames: () => (isSadburst ? findSadburstNames({ gameDir, say }) : findOfficialNames({ gameDir, out: client.names, say })),
    say,
    note,
  });
}
