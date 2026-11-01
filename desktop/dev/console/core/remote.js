// Remote play (src/features/remote_play/): this game window is streamed to a tester's browser as
// video. The tester sees only its pixels, so what the console shows is all they can
// learn. In remote mode the console:
//   - leaves out commands marked `remote: false` ("js" runs any code; "hooks" lists the
//     host's hooks), as if they did not exist;
//   - hides, in everything it prints, the host's file paths and file names and the
//     game's obfuscated names (they map the game's internals).
// The wrapper sets PB2_REMOTE (not enumerable) before any script, for remote windows only.
import { SERVER } from './server.js';
import { isFeatureOn } from '../../../../src/console/flags.ts';
import { makeRedactor } from '../../../../src/features/remote_play/domain/redactor.ts';
import { HIDDEN } from '../../../../src/features/remote_play/text.ts';

export { makeRedactor, HIDDEN };

export const REMOTE = globalThis.PB2_REMOTE === true;

// For this page: the identity outside remote mode.
export const redact = REMOTE ? makeRedactor(globalThis.PB2_NAMES || {}) : (text) => text;

// Whether a command (or subcommand) definition exists in this mode: remote play leaves
// out `remote: false`, `server: true` exists only on the dedicated host (core/server.js),
// and a definition of a feature (`feature: <id>`) exists only while its flag is on.
export const allowedHere = (def) => !(REMOTE && def.remote === false) && !(def.server === true && !SERVER)
  && !(def.feature && !isFeatureOn(def.feature));
