import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { NETLOG_PARTS } from './capabilities.ts';
import { NET_TICK_MS, TICK_ERRORS_SHOWN } from './constants.ts';
import { COMMAND } from './keys.ts';
import { TICK_NAME } from './text.ts';
import { recorder } from './services/page-recorder.ts';

export { recorder };

export const netlogConsole = consoleFeatureOf(FEATURE.netlog, NETLOG_PARTS, {
  shells: [{ name: COMMAND.name, aliases: COMMAND.aliases }],
  ticks: [{ name: TICK_NAME, everyMs: NET_TICK_MS, errorsShown: TICK_ERRORS_SHOWN, run: () => recorder.tick() }],
});
