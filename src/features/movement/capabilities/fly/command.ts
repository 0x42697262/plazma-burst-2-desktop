import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { runKey, setKey } from '#console/kernel/commands/settings.ts';
import { settings } from '#console/kernel/state/store.ts';
import { FLY_COMMAND, FLY_MODE, SETTING } from '../../keys.ts';
import { TEXT } from './text.ts';
import { protectionHint } from '#console/kernel/ports/protection.ts';
import { setSweeping, sweep } from './sweep.ts';
import { isSweepReady, sweepRange } from './override.ts';

const SWEEP_OPTIONS: readonly string[] = Object.freeze([FLY_COMMAND.on, FLY_COMMAND.off, FLY_COMMAND.toggle]);

function runSweep(option: string): void {
  const shouldSweep = option === FLY_COMMAND.toggle ? !sweep.active : option === FLY_COMMAND.on;
  if (!shouldSweep) {
    setSweeping(false);
    print(TEXT.stopped, COLOR.ok);
    return;
  }
  if (settings.get(SETTING.fly) !== FLY_MODE.sweep) setKey(SETTING.fly, FLY_MODE.sweep);
  setSweeping(true);
  const range = sweepRange();
  print(TEXT.sweeping(range), COLOR.ok);
  if (range < (settings.effective(SETTING.flySweepRange) as number)) print(TEXT.heldBack(range, protectionHint()), COLOR.warn);
  if (!isSweepReady()) print(TEXT.notReady, COLOR.hint);
}

function run(args: readonly string[]): void {
  const { options, rest } = takeOptions(args, SWEEP_OPTIONS);
  if (!options.size) {
    if (rest.length && String(rest[0]).toLowerCase() !== FLY_MODE.sweep) setSweeping(false);
    runKey(SETTING.fly, rest);
    return;
  }
  const isSweepWord = rest.length === 1 && String(rest[0]).toLowerCase() === FLY_MODE.sweep;
  if (!isSweepWord || options.size > 1) throw new Error(TEXT.usageError);
  runSweep([...options][0] ?? '');
}

export const flyCommand = Object.freeze({
  name: FLY_COMMAND.name,
  capability: CAPABILITY.movement.fly,
  usage: TEXT.usage,
  desc: TEXT.description,
  clientOnly: TEXT.clientOnly,
  help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, see: TEXT.see },
  run,
});
