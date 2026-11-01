import { CLIENT_PATHS } from '#kernel/config/paths.ts';

export const fingerprintDir = (isSadburst: boolean): string => (isSadburst ? CLIENT_PATHS.sadburst : CLIENT_PATHS.official).fingerprintDir;
