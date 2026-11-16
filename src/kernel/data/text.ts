export const TEXT = Object.freeze({
  moved: (from: string, to: string) => `Moved ${from} to ${to} (local data now lives in data/)`,
  droppedCopy: (from: string, to: string) => `Removed ${from}: the same file is in ${to}`,
  bothExist: (from: string, to: string) => `Both ${from} and ${to} exist: ${to} is used. Merge ${from} into it by hand, or delete ${from}.`,
  retired: (file: string, instead: string) => `${file} is no longer read: every game client uses ${instead}. Copy what you want from it by hand, then delete it.`,
  notMoved: (from: string, message: string) => `${from} could not be moved to data/: ${message}`,
});
