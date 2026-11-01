import { TEXT } from '../text.ts';

export type FoundNames = Readonly<{ missing: readonly string[] }>;

export type GameSetupDeps = Readonly<{
  localVersion(): string | null;
  latestVersion: (() => Promise<string>) | null;
  checksForUpdates: boolean;
  download(version: string | null): Promise<readonly string[]>;
  namesMatchGame(): boolean;
  findNames(): FoundNames;
  say(line: string): void;
  note(line: string): void;
}>;

export type SetupResult = Readonly<{ ready: boolean; downloaded: boolean; problems: readonly string[] }>;

async function wantedVersion(deps: GameSetupDeps, local: string | null): Promise<{ latest: string | null; problem: string | null }> {
  const asksTheSite = deps.latestVersion !== null && (deps.checksForUpdates || local === null);
  if (!asksTheSite || !deps.latestVersion) return { latest: null, problem: null };
  deps.note(TEXT.checking);
  try {
    return { latest: await deps.latestVersion(), problem: null };
  } catch (error) {
    const message = (error as Error).message;
    if (local === null) return { latest: null, problem: TEXT.cannotDownload(message) };
    deps.note(TEXT.offline(local, message));
    return { latest: null, problem: null };
  }
}

export async function ensureGame(deps: GameSetupDeps): Promise<SetupResult> {
  const local = deps.localVersion();
  const { latest, problem } = await wantedVersion(deps, local);
  if (problem) return Object.freeze({ ready: false, downloaded: false, problems: [problem] });
  const problems: string[] = [];
  const isNewer = latest !== null && local !== null && latest !== local;
  const needsDownload = local === null || isNewer;
  if (isNewer) deps.say(TEXT.newVersion(local, latest));
  if (needsDownload) {
    deps.say(TEXT.downloading(latest));
    try {
      problems.push(...await deps.download(latest));
    } catch (error) {
      if (local === null) return Object.freeze({ ready: false, downloaded: false, problems: [TEXT.cannotDownload((error as Error).message)] });
      deps.note(TEXT.offline(local, (error as Error).message));
    }
  }
  const downloaded = needsDownload && deps.localVersion() !== local;
  if (downloaded || !deps.namesMatchGame()) {
    deps.say(TEXT.findingNames);
    const { missing } = deps.findNames();
    if (missing.length) problems.push(TEXT.namesMissing(missing));
  }
  return Object.freeze({ ready: deps.localVersion() !== null, downloaded, problems });
}
