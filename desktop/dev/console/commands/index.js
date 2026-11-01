// Every console command, in the order "help" lists them.
import { register } from './registry.js';
import { helpCommand } from './help.js';
import { settingsCommands } from './settings.js';
import { moreCommand, chainTopic, consoleCommands } from './console.js';
import { featuresCommand } from '../../../../src/console/kernel/commands/features.ts';
import { enabledConsoleFeatures, featureCommands } from '../../../../src/console/features.ts';

const [list, set, get, unset, reset, builtin] = settingsCommands;

register(
  helpCommand, list, set, get, unset, reset,
  chainTopic, moreCommand,
  builtin, featuresCommand, ...consoleCommands,
  ...featureCommands(enabledConsoleFeatures()),
);
