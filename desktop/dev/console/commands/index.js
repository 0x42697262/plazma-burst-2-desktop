// Every console command, in the order "help" lists them.
import { register } from './registry.js';
import { helpCommand } from './help.js';
import { settingsCommands } from './settings.js';
import { profileCommand } from './profile.js';
import { playerCommands, tpCommand, posCommand, charsCommand } from './player.js';
import { gunsCommand, gunCommands } from './guns.js';
import { bindCommands } from './binds.js';
import { keynameCommand } from './keyname.js';
import { triggersCommand } from './triggers.js';
import { varsCommand } from './vars.js';
import { logicCommand } from './logic.js';
import { regionsCommand } from './regions.js';
import { traceCommand } from './trace.js';
import { moreCommand, chainTopic, consoleCommands } from './console.js';
import { gameCommand } from './game-chat.js';
import { mapsCommand } from './maps.js';
import { screenshotCommand } from './screenshot.js';
import { editorCommand } from './editor.js';
import { jsCommand } from './js.js';

const [list, set, get, unset, reset, builtin] = settingsCommands;

register(
  helpCommand, list, set, get, unset, reset, profileCommand,
  ...playerCommands, gunsCommand, tpCommand, posCommand, ...gunCommands, charsCommand, traceCommand,
  ...bindCommands, keynameCommand, triggersCommand, regionsCommand, varsCommand, logicCommand, editorCommand, chainTopic, moreCommand,
  gameCommand, builtin, mapsCommand, screenshotCommand, jsCommand, ...consoleCommands,
);
