export const COMMAND = Object.freeze({ name: 'screenshot', aliases: ['ss', 'shot'], consoleOption: 'console' });
export const FILE_PREFIX = 'pb2-';
export const FILE_EXTENSION = '.png';
export const EXCLUSIVE_CREATE_FLAG = 'wx';
export const EXISTS_ERROR_CODE = 'EEXIST';
export const NOTICE_TAG = 'div';
export const shotFileName = (stamp: string, attempt: number): string => `${FILE_PREFIX}${stamp}${attempt > 1 ? `-${attempt}` : ''}${FILE_EXTENSION}`;
export const SETTING = Object.freeze({ screenshotKey: 'screenshot_key' });
