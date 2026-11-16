import { CLIENT, type ClientId } from '#shared/features/keys.ts';
import { CLIENT_FLAG, COMMAND_FLAG, ELECTRON_ARGS_FLAG, GONE_PROCESS, LEVEL_FLAG } from './constants.ts';
import { TEXT } from './text.ts';

export type SmokeArgs = Readonly<{ client: ClientId; levelFile: string | null; commands: string[]; electronArgs: string[]; problem: string | null }>;

const CLIENT_IDS: readonly string[] = Object.values(CLIENT);
const isClientId = (value: string): value is ClientId => CLIENT_IDS.includes(value);

export function parseSmokeArgs(argv: readonly string[]): SmokeArgs {
  const electronArgsStart = argv.indexOf(ELECTRON_ARGS_FLAG);
  const ownArgs = electronArgsStart < 0 ? [...argv] : argv.slice(0, electronArgsStart);
  const electronArgs = electronArgsStart < 0 ? [] : argv.slice(electronArgsStart + 1);
  const commands = ownArgs.flatMap((arg, index) => (ownArgs[index - 1] === COMMAND_FLAG ? [arg] : []));
  const problems: string[] = [];
  const valueAfter = (flag: string): string | null => {
    if (!ownArgs.includes(flag)) return null;
    const value = ownArgs[ownArgs.indexOf(flag) + 1];
    if (value === undefined) problems.push(TEXT.needsValue(flag));
    return value ?? null;
  };
  const askedClient = valueAfter(CLIENT_FLAG);
  const levelFile = valueAfter(LEVEL_FLAG);
  let client: ClientId = CLIENT.official;
  if (askedClient !== null && isClientId(askedClient)) client = askedClient;
  else if (askedClient !== null) problems.push(TEXT.unknownClient(askedClient, CLIENT_IDS));
  if (levelFile !== null && client !== CLIENT.official) problems.push(TEXT.levelOfficialOnly);
  return { client, levelFile, commands, electronArgs, problem: problems[0] ?? null };
}

type Kill = (pid: number) => void;

export function stopGroup(pid: number | undefined, kill: Kill = (target) => { process.kill(target); }): void {
  if (pid === undefined) return;
  try {
    kill(-pid);
  } catch (error) {
    if ((error as { code?: string }).code !== GONE_PROCESS) throw error;
  }
}
