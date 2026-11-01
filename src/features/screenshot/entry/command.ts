import { print } from '#console/kernel/ui/log.ts';
import { setPanelHidden } from '../../../../desktop/dev/console/ui/panel.js';
import { el } from '#console/kernel/ui/dom.ts';
import { IN_OVERLAY } from '#console/kernel/ui/theme.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { ROUTE } from '#shared/contract/routes.ts';
import { HTTP_METHOD } from '#shared/contract/keys.ts';
import { NOTICE_MS, NOTICE_STYLE, SETTLE_FRAMES } from '../constants.ts';
import { COMMAND, NOTICE_TAG } from '../keys.ts';
import { TEXT } from '../text.ts';

type Overlay = { append(node: unknown): void };
type Removable = { remove(): void };
const overlay = (): Overlay => (game as unknown as { overlay(): Overlay }).overlay();
const makeElement = el as (tag: string, style: Record<string, string>, text: string) => Removable;
const hidePanel = setPanelHidden as (hidden: boolean) => void;

function notice(text: string, color: string): void {
  const node = makeElement(NOTICE_TAG, { ...(IN_OVERLAY as Record<string, string>), ...NOTICE_STYLE, color }, text);
  overlay().append(node);
  setTimeout(() => node.remove(), NOTICE_MS);
}

const nextFrame = (): Promise<number> => new Promise((resolve) => requestAnimationFrame(resolve));

async function capture(hideConsole: boolean): Promise<string> {
  if (hideConsole) hidePanel(true);
  try {
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) await nextFrame();
    const response = await fetch(ROUTE.screenshot, { method: HTTP_METHOD.post });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json() as { file: string }).file;
  } finally {
    if (hideConsole) hidePanel(false);
  }
}

function screenshot(args: readonly string[]): Promise<void> {
  const { options, rest } = takeOptions(args, [COMMAND.consoleOption]) as { options: Set<string>; rest: string[] };
  if (rest.length) throw new Error(TEXT.usageError);
  return capture(!options.has(COMMAND.consoleOption)).then(
    (file) => {
      print(TEXT.saved(file), COLOR.ok);
      notice(TEXT.saved(file), COLOR.ok);
    },
    (error: unknown) => {
      const text = TEXT.failed((error as Error | null)?.message ?? '');
      print(TEXT.errorLine(text), COLOR.error);
      notice(text, COLOR.error);
    },
  );
}

export const screenshotCommand = Object.freeze({
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, notes: TEXT.notes, see: TEXT.see },
  run: screenshot,
});
