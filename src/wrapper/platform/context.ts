import type { BrowserWindow } from 'electron';
import type { KvFile } from './kv-file.ts';
import type { RequestFetch } from './game-files.ts';

export type PageContext = {
  remote: boolean;
  server?: boolean;
  name: string;
  fetch: RequestFetch;
  kvFile: KvFile | null;
  readonly window: BrowserWindow | null;
};
