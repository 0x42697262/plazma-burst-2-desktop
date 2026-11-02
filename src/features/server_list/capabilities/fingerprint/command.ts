import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND, OPERATION } from '../../keys.ts';
import { askServerList } from '../../adapters/route-client.ts';
import { reportingErrors } from '../../services/console-actions.ts';
import { FINGERPRINT_COMMAND } from './keys.ts';
import { FINGERPRINT_TEXT as TEXT } from './text.ts';

async function fingerprint(args: readonly string[]): Promise<void> {
  const [address] = args;
  if (!address) throw new Error(TEXT.fingerprintUsage);
  print(TEXT.fingerprintLine(address, await askServerList<string>(OPERATION.fingerprint, address)), COLOR.ok);
}

export const fingerprintCommand = Object.freeze({
  parent: COMMAND.name, name: FINGERPRINT_COMMAND.name, aliases: FINGERPRINT_COMMAND.aliases, usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about, examples: TEXT.examples }, run: reportingErrors(fingerprint),
});
