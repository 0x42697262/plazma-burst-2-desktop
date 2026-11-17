import { takeOptions } from '#console/kernel/core/args.ts';
import { COMMAND } from '../keys.ts';
import { TEXT } from '../text.ts';
import type { FreeCamera } from '../services/free-camera.ts';

export function createFreeCameraCommand(camera: FreeCamera) {
  function run(args: readonly string[]): void {
    const { options, rest } = takeOptions(args, [COMMAND.on, COMMAND.off]);
    if (rest.length || options.size > 1) throw new Error(TEXT.usageError);
    if (options.has(COMMAND.on)) {
      if (!camera.isOn()) camera.turnOn();
    } else if (options.has(COMMAND.off)) camera.turnOff();
    else camera.toggle();
  }

  return Object.freeze({
    name: COMMAND.name,
    usage: TEXT.usage,
    desc: TEXT.description,
    clientOnly: TEXT.clientOnly,
    holds: true,
    help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, see: TEXT.see },
    run,
  });
}
