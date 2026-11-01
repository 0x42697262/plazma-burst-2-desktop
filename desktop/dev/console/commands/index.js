// Every console command, in the order "help" lists them.
import { register } from './registry.js';
import { helpCommand } from './help.js';
import { settingsCommands } from './settings.js';
import { triggersCommand } from './triggers.js';
import { varsCommand } from './vars.js';
import { logicCommand } from './logic.js';
import { regionsCommand } from './regions.js';
import { moreCommand, chainTopic, consoleCommands } from './console.js';
import { mapsCommand } from './maps.js';
import { editorCommand } from './editor.js';
import { hooksCommand } from './hooks.js';
import { serverCommand, serverShortcuts } from './server.js';
import { featuresCommand } from '../../../../src/console/kernel/commands/features.ts';
import { enabledConsoleFeatures, featureCommands } from '../../../../src/console/features.ts';

const [list, set, get, unset, reset, builtin] = settingsCommands;

register(
  serverCommand, ...serverShortcuts, // the dedicated host only (core/server.js)
  helpCommand, list, set, get, unset, reset,
  triggersCommand, regionsCommand, varsCommand, logicCommand, editorCommand, chainTopic, moreCommand,
  builtin, mapsCommand, hooksCommand, featuresCommand, ...consoleCommands,
  ...featureCommands(enabledConsoleFeatures()),
);
