import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { runKey, setKey, unsetKey } from '#console/kernel/commands/settings.ts';
import { settings } from '#console/kernel/state/store.ts';
import { FLY_COMMAND, SETTING, SWEEP_MODES } from '../../keys.ts';
import { TEXT } from './text.ts';
import { protectionHint } from '#console/kernel/ports/protection.ts';
import { setSweeping, sweep } from './sweep.ts';
import { isInverse, isSweepReady, sweepRange } from './override.ts';

const RUN_OPTIONS: readonly string[] = Object.freeze([FLY_COMMAND.on, FLY_COMMAND.off, FLY_COMMAND.toggle]);
const AIM_OPTIONS: readonly string[] = Object.freeze([FLY_COMMAND.default, FLY_COMMAND.plain, FLY_COMMAND.inverse, FLY_COMMAND.directional]);
const AIM_SAID: Readonly<Record<string, string>> = Object.freeze({ [FLY_COMMAND.default]: TEXT.aimDefault, [FLY_COMMAND.plain]: TEXT.aimPlain, [FLY_COMMAND.inverse]: TEXT.aimInverse, [FLY_COMMAND.directional]: TEXT.aimDirectional });
const SWEEP_OPTIONS: readonly string[] = Object.freeze([...RUN_OPTIONS, ...AIM_OPTIONS]);

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
  const runOptions = [...options].filter((option) => RUN_OPTIONS.includes(option));
  const aimOptions = [...options].filter((option) => AIM_OPTIONS.includes(option));
  if (rest.length !== 1 || !SWEEP_MODES.includes(mode) || runOptions.length > 1 || aimOptions.length > 1) throw new Error(TEXT.usageError);
  const [aim] = aimOptions;
  if (aim) {
    if (aim === FLY_COMMAND.default) unsetKey(SETTING.flySweepAim);
    else setKey(SETTING.flySweepAim, aim);
    sweep.inverse = isInverse();
    print(AIM_SAID[aim] ?? TEXT.aimDefault, COLOR.ok);
  }
  const [runOption] = runOptions;
  if (runOption) runSweep(runOption, mode);
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
