export type ProtectionSwitch = Readonly<{ isOff(): boolean; isAsking(): boolean; answer(line: string): void; hint: string }>;

let protectionSwitch: ProtectionSwitch | null = null;

export const provideProtectionSwitch = (provided: ProtectionSwitch): void => { protectionSwitch = provided; };
export const protectionOff = (): boolean => protectionSwitch?.isOff() ?? false;
export const answersNextLine = (): boolean => protectionSwitch?.isAsking() ?? false;
export const answerProtection = (line: string): void => { protectionSwitch?.answer(line); };
export const protectionHint = (): string => protectionSwitch?.hint ?? '';
