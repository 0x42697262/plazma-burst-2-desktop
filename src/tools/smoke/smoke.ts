import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { connectCdp, type CdpSession } from './cdp.ts';
import {
  BOOT_TIMEOUT_MS, CDP, CONSOLE_LINE_PREFIX, DEFAULT_CLIENT, CONSOLE_READY_EXPRESSION, DEBUG_PORT_SWITCH,
  ELECTRON_BIN, GAME_URL_PREFIX, LAUNCHER_URL_SUFFIX, PAGE_TARGET_TYPE, POLL_MS,
  SETTLE_MS, TARGET_LIST_URL, ENTER_AS_GUEST_EXPRESSION, GAME_LOADED_EXPRESSION, LAUNCHER_READY_EXPRESSION, LEVEL_CHECK_COMMAND, LEVEL_RUNNING_LINE, startLevelCommand, APP_DIR, CONSOLE_ARGUMENT_SEPARATOR, playOwnExpression, runCommandExpression,
} from './constants.ts';
import { TEXT } from './text.ts';

type Target = { type: string; url: string; webSocketDebuggerUrl: string };
type EvaluateResult = { result?: { value?: unknown }; exceptionDetails?: { exception?: { description?: string } } };
type ConsoleCall = { args?: { value?: string | number | boolean | null }[] };

export type SmokeOptions = { client: string; level: string | null; electronArgs: readonly string[]; commands: readonly string[]; report: (line: string) => void };
export type SmokeResult = { consoleReady: boolean; output: Map<string, string[]> };

async function waitFor<T>(what: string, probe: () => Promise<T | null>): Promise<T> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const found = await probe().catch(() => null);
    if (found !== null) return found;
    await sleep(POLL_MS);
  }
  throw new Error(TEXT.timedOut(what));
}

async function pageTargets(): Promise<Target[]> {
  const response = await fetch(TARGET_LIST_URL);
  const targets = await response.json() as Target[];
  return targets.filter((target) => target.type === PAGE_TARGET_TYPE);
}

const findPage = (matches: (url: string) => boolean) => async (): Promise<Target | null> => (await pageTargets()).find((target) => matches(target.url)) ?? null;

async function evaluate(session: CdpSession, expression: string): Promise<unknown> {
  const evaluated = await session.send(CDP.evaluate, { expression, awaitPromise: true, returnByValue: true }) as EvaluateResult;
  return evaluated.exceptionDetails ? evaluated.exceptionDetails.exception?.description : evaluated.result?.value;
}

function collectConsoleLines(session: CdpSession): string[] {
  const lines: string[] = [];
  session.on(CDP.consoleCalled, (params) => {
    const call = params as ConsoleCall;
    const text = (call.args ?? []).map((argument) => String(argument.value ?? '')).join(CONSOLE_ARGUMENT_SEPARATOR);
    if (text.startsWith(CONSOLE_LINE_PREFIX)) lines.push(text.slice(CONSOLE_LINE_PREFIX.length));
  });
  return lines;
}

export async function runSmoke({ client, level, electronArgs, commands, report }: SmokeOptions): Promise<SmokeResult> {
  const args = [APP_DIR, DEBUG_PORT_SWITCH, ...electronArgs];
  report(TEXT.started(args));
  const electron: ChildProcess = spawn(path.join(REPO_ROOT, ELECTRON_BIN), args, { cwd: REPO_ROOT, stdio: 'ignore', detached: true });
  const output = new Map<string, string[]>();
  try {
    await waitFor(TEXT.waitingFor.debugger, async () => (await pageTargets()).length ? true : null);
    const launcher = await waitFor(TEXT.waitingFor.launcher, findPage((url) => url.endsWith(LAUNCHER_URL_SUFFIX)));
    report(TEXT.launcher);
    const launcherSession = await connectCdp(launcher.webSocketDebuggerUrl);
    await waitFor(TEXT.waitingFor.launcher, async () => (await evaluate(launcherSession, LAUNCHER_READY_EXPRESSION)) === true ? true : null);
    void evaluate(launcherSession, playOwnExpression(client)).then((played) => { if (played !== true) report(TEXT.playFailed(JSON.stringify(played))); }).catch(() => null);
    const game = await waitFor(TEXT.waitingFor.game, findPage((url) => url.startsWith(GAME_URL_PREFIX)));
    launcherSession.close();
    report(TEXT.gamePage(game.url));
    const gameSession = await connectCdp(game.webSocketDebuggerUrl);
    const lines = collectConsoleLines(gameSession);
    await gameSession.send(CDP.enableRuntime);
    await waitFor(TEXT.waitingFor.console, async () => (await evaluate(gameSession, CONSOLE_READY_EXPRESSION)) === true ? true : null);
    report(TEXT.consoleReady);
    if (client !== DEFAULT_CLIENT) {
      await waitFor(TEXT.waitingFor.gameScripts, async () => {
        await evaluate(gameSession, ENTER_AS_GUEST_EXPRESSION);
        return (await evaluate(gameSession, GAME_LOADED_EXPRESSION)) === true ? true : null;
      });
      report(TEXT.gameStarted);
    }
    if (level !== null) {
      await evaluate(gameSession, runCommandExpression(startLevelCommand(level)));
      await waitFor(TEXT.waitingFor.level, async () => {
        lines.length = 0;
        await evaluate(gameSession, runCommandExpression(LEVEL_CHECK_COMMAND));
        await sleep(SETTLE_MS);
        return lines.some((line) => LEVEL_RUNNING_LINE.test(line)) ? true : null;
      });
      report(TEXT.levelStarted);
    }
    for (const line of commands) {
      lines.length = 0;
      await evaluate(gameSession, runCommandExpression(line));
      await sleep(SETTLE_MS);
      output.set(line, lines.filter((printed) => !printed.startsWith(TEXT.command(''))));
    }
    gameSession.close();
    return { consoleReady: true, output };
  } finally {
    if (electron.pid !== undefined) process.kill(-electron.pid);
  }
}
