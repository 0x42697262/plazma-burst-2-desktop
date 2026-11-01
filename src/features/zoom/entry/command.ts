import { takeOptions, oneOf } from '#console/kernel/core/args.ts';
import { DEFAULT_PERCENT } from '../constants.ts';
import { COMMAND, PERCENT_SUFFIX } from '../keys.ts';
import { TEXT } from '../text.ts';
import type { Zoom } from '../services/zoom.ts';

type Options = { options: Set<string>; rest: string[] };

export function createZoomCommand(zoom: Zoom) {
  function run(args: readonly string[]): void {
    const { options, rest } = takeOptions(args, [COMMAND.lock, COMMAND.unlock]) as Options;
    const how = (oneOf as (options: Set<string>, names: string[]) => string | undefined)(options, [COMMAND.lock, COMMAND.unlock]);
    const [word, ...extra] = rest;
    if (extra.length) throw new Error(TEXT.usageError);
    if (word === undefined) {
      if (how === COMMAND.unlock) zoom.unlock();
      else if (how === COMMAND.lock) throw new Error(TEXT.usageError);
      else zoom.show();
      return;
    }
    if (how === COMMAND.unlock) throw new Error(TEXT.usageError);
    const number = word.replace(PERCENT_SUFFIX, '');
    zoom.set(number === COMMAND.defaultWord ? DEFAULT_PERCENT : Number(number), how === COMMAND.lock);
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
