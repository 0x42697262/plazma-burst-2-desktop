export const TEXT = Object.freeze({
  moved: (from: string, to: string) => `Moved ${from} to ${to} (local data now lives in data/)`,
  bothExist: (from: string, to: string) => `Both ${from} and ${to} exist: ${to} is used. Merge ${from} into it by hand, or delete ${from}.`,
  notMoved: (from: string, message: string) => `${from} could not be moved to data/: ${message}`,
});
