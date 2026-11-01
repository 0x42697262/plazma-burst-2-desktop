export const DOMAIN_TEXT = Object.freeze({
  numberedName: (title: string, ordinal: number | undefined) => `${title} #${ordinal}`,
  headerLine: (header: string, value: string) => `${header}: ${value}`,
  actionLine: (name: string, targetA: string, targetB: string) => `${name}( "${targetA}", "${targetB}" );`,
  lineBreak: '\n',
  labelledValue: (value: string, label: string) => `${value} (${label})`,
});
