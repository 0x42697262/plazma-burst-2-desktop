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
import { zoomCommand } from './zoom.js';
import { mapsCommand } from './maps.js';
import { screenshotCommand } from './screenshot.js';
import { editorCommand } from './editor.js';
import { jsCommand } from './js.js';
import { hooksCommand } from './hooks.js';
import { netlogCommand } from './netlog.js';
import { fingerprintCommand } from './fingerprint.js';
import { bypassCommand } from './bypass.js';
import { serverCommand, serverShortcuts } from './server.js';
import { serversCommand } from './servers.js';

const [list, set, get, unset, reset, builtin] = settingsCommands;

register(
  serverCommand, ...serverShortcuts, // the dedicated host only (core/server.js)
  helpCommand, list, set, get, unset, reset, profileCommand,
  ...playerCommands, gunsCommand, tpCommand, posCommand, ...gunCommands, charsCommand, traceCommand,
  ...bindCommands, keynameCommand, triggersCommand, regionsCommand, varsCommand, logicCommand, editorCommand, chainTopic, moreCommand,
  gameCommand, zoomCommand, builtin, mapsCommand, serversCommand, screenshotCommand, netlogCommand, fingerprintCommand, bypassCommand, jsCommand, hooksCommand, ...consoleCommands,
);
