import { z } from 'zod';
import { createVersionedFile } from '#kernel/persist/versioned.ts';
import { CONFIG_FILE_VERSION } from '../constants.ts';
import type { ConfigValues } from '../domain/config.ts';

const configSchema = z.object({ host: z.string().optional(), send: z.array(z.string()).optional(), auto: z.boolean().optional() });

export function readConfigFile(file: string): { values: ConfigValues; problem: string | null } {
  const store = createVersionedFile({ file, version: CONFIG_FILE_VERSION, schema: configSchema, migrations: { 0: (data) => data } });
  try {
    return { values: store.readSync()?.value ?? {}, problem: null };
  } catch (error) {
    return { values: {}, problem: (error as Error).message };
  }
}
