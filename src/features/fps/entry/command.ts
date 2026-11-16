import { COMMAND } from '../keys.ts';
import { TEXT } from '../text.ts';
import { parseFpsWords } from '../domain/words.ts';
import type { Fps, FpsState } from '../services/fps.ts';

export type FpsOutput = Readonly<{ say(text: string): void; warn(text: string): void }>;

const shown = (state: FpsState): string => TEXT.now(state.fps === null ? TEXT.unknown : String(state.fps), state.physics, state.logic ?? TEXT.unknown);

export function createFpsCommand(fps: Fps, output: FpsOutput) {
  function run(args: readonly string[]): void {
    const change = parseFpsWords(args);
    if (!args.length) {
      output.say(shown(fps.state()));
      return;
    }
    const { hasLogic } = fps.set(change);
    if (!hasLogic) output.warn(TEXT.noLogic);
    output.say(shown(fps.state()));
  }

  return Object.freeze({
    name: COMMAND.name,
    usage: TEXT.usage,
    desc: TEXT.description,
    clientOnly: TEXT.clientOnly,
    help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, see: TEXT.see },
    run,
  });
}
