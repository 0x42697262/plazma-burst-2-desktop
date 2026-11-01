export const CONSOLE_ENTRY: string;
export const LEGACY_CONSOLE_DIR: string;

export type FakeGameLog = { net: any[]; runs: any[]; ran: any[]; printed: Lines; frames: any[]; drawn: any[] };

export type Lines = [string, ...string[]];

export type FakeGame = {
  G: Record<string, any>;
  N: any;
  globals: Record<string, any>;
  names: any;
  log: FakeGameLog;
  store: Map<string, string>;
  chars: any[];
  triggers: any[];
  globalsBeforeConsole: string[];
  intervals: (() => void)[];
  player: any;
  run(line: string): Lines;
  frame(count?: number): void;
  press(code: string, modifiers?: Record<string, unknown>): Lines;
  setMP(on: boolean): void;
  dispatch(...args: any[]): unknown;
};

export function bootConsole(options?: { mapFile?: string; sayTrigger?: string; entry?: string }): Promise<FakeGame>;
