export const TEXT = Object.freeze({
  report: (dir: string, files: number, changedFiles: number, changedLines: number) => `${dir}: ${files} logs read, ${changedLines} lines with a password rewritten in ${changedFiles} files.`,
});
