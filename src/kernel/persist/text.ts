export const TEXT = Object.freeze({
  notJson: (file: string, reason: string) => `${file} is not valid JSON: ${reason}`,
  notObject: (file: string) => `${file} must hold a JSON object`,
  futureVersion: (file: string, found: number, known: number) => `${file} is version ${found}, but this app knows up to version ${known}. Update the app; the file was not changed.`,
  badVersion: (file: string) => `${file} has a schemaVersion that is not a whole number`,
  missingMigration: (file: string, from: number) => `${file}: no migration from version ${from}`,
  invalid: (file: string, issues: string) => `${file} does not match its schema: ${issues}`,
});
