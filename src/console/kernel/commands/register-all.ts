import { register, type CommandDefinition } from './registry.ts';
import { helpCommand } from './help.ts';
import { settingsCommands } from './settings.ts';
import { moreCommand, chainTopic, consoleCommands } from './console-commands.ts';
import { featuresCommand } from './features.ts';
import { enabledConsoleFeatures, featureCommands } from '../../features.ts';

const [list, set, get, unset, reset, builtin] = settingsCommands;
const settingCommands = [list, set, get, unset, reset].filter((command): command is CommandDefinition => command !== undefined);

register(
  helpCommand, ...settingCommands,
  chainTopic, moreCommand,
  ...(builtin ? [builtin] : []), featuresCommand, ...consoleCommands,
  ...(featureCommands(enabledConsoleFeatures()) as CommandDefinition[]),
);
