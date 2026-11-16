import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { runKey, setKey } from '#console/kernel/commands/settings.ts';
import { settings } from '#console/kernel/state/store.ts';
import { FLY_COMMAND, SETTING, SWEEP_MODES } from '../../keys.ts';
import { TEXT } from './text.ts';
import { protectionHint } from '#console/kernel/ports/protection.ts';
import { setSweeping, sweep } from './sweep.ts';
import { isSweepReady, sweepRange } from './override.ts';

const SWEEP_OPTIONS: readonly string[] = Object.freeze([FLY_COMMAND.on, FLY_COMMAND.off, FLY_COMMAND.toggle]);

function runSweep(option: string, mode: string): void {
  const shouldSweep = option === FLY_COMMAND.toggle ? !sweep.active : option === FLY_COMMAND.on;
  if (!shouldSweep) {
    setSweeping(false);
    print(TEXT.stopped, COLOR.ok);
    return;
  }
  if (settings.get(SETTING.fly) !== mode) setKey(SETTING.fly, mode);
  setSweeping(true);
  const range = sweepRange();
  print(TEXT.sweeping(range), COLOR.ok);
  if (range < (settings.effective(SETTING.flySweepRange) as number)) print(TEXT.heldBack(range, protectionHint()), COLOR.warn);
  if (!isSweepReady()) print(TEXT.notReady, COLOR.hint);
}

function run(args: readonly string[]): void {
  const { options, rest } = takeOptions(args, SWEEP_OPTIONS);
  if (!options.size) {
    if (rest.length && !SWEEP_MODES.includes(String(rest[0]).toLowerCase())) setSweeping(false);
    runKey(SETTING.fly, rest);
    return;
  }
  const mode = String(rest[0] ?? '').toLowerCase();
  if (rest.length !== 1 || !SWEEP_MODES.includes(mode) || options.size > 1) throw new Error(TEXT.usageError);
  runSweep([...options][0] ?? '', mode);
}

export const flyCommand = Object.freeze({
  name: FLY_COMMAND.name,
  capability: CAPABILITY.movement.fly,
  usage: TEXT.usage,
  desc: TEXT.description,
  clientOnly: TEXT.clientOnly,
  holds: true,
  help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, see: TEXT.see },
  run,
});
