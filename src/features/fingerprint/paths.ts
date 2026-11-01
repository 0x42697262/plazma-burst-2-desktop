import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';

export const FINGERPRINT_DIR_NAME = 'fingerprint';
export const SADBURST_FINGERPRINT_DIR_NAME = 'fingerprint.sadburst';
export const fingerprintDir = (isSadburst: boolean): string => path.join(REPO_ROOT, isSadburst ? SADBURST_FINGERPRINT_DIR_NAME : FINGERPRINT_DIR_NAME);
