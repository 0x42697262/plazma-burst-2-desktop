import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { gameNetwork } from '#console/kernel/game/network.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import { isJoiningPrivateServer } from '#page/join-target.ts';
import { CAPTURE_ERRORS_SHOWN, CAPTURE_TICK_MS } from './constants.ts';
import { CAPTURE_TEXT } from './text.ts';
import { createFingerprintCapture } from './services/capture.ts';
import { FINGERPRINT_PARTS } from './capabilities.ts';
import { COMMAND } from './keys.ts';
import { postFingerprint } from './adapters/wrapper-client.ts';

export const fingerprintCapture = createFingerprintCapture({
  network: gameNetwork,
  save: postFingerprint,
  isPrivateLobby: isJoiningPrivateServer,
  isRemote: REMOTE,
  announce: (saved) => print(CAPTURE_TEXT.newVersion(saved.id, saved.file), COLOR.hint),
  warn: (message) => console.warn(CAPTURE_TEXT.notSaved(message)),
});

export const fingerprintConsole = consoleFeatureOf(FEATURE.fingerprint, FINGERPRINT_PARTS, {
  shells: [{ name: COMMAND.name, aliases: COMMAND.aliases, remote: false }],
  ticks: [{ name: CAPTURE_TEXT.tickName, everyMs: CAPTURE_TICK_MS, errorsShown: CAPTURE_ERRORS_SHOWN, run: fingerprintCapture.tick }],
});
