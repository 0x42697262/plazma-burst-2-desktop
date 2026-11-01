import crypto from 'node:crypto';
import { z } from 'zod';
import { createVersionedFile, type VersionedFile } from '#kernel/persist/versioned.ts';
import { TESTERS_FILE_MODE, TESTERS_FILE_VERSION, TOKEN_BYTES } from '../constants.ts';
import { TOKEN_ENCODING, TOKEN_HASH } from '../keys.ts';
import { checkTesterName } from '../domain/tester-name.ts';

const testerSchema = z.object({ token: z.string(), added: z.string().optional() }).loose();
const testersSchema = z.object({ testers: z.record(z.string(), testerSchema) });
type Testers = z.infer<typeof testersSchema>;

export type Tester = { name: string };
export type TesterRow = { name: string; added: string };

const noTesters = (): Testers => ({ testers: {} });

function storeOf(file: string): VersionedFile<Testers> {
  return createVersionedFile<Testers>({
    file,
    version: TESTERS_FILE_VERSION,
    schema: testersSchema,
    migrations: { 0: (data) => (typeof data.testers === 'object' && data.testers !== null ? data : noTesters()) },
    fileMode: TESTERS_FILE_MODE,
  });
}

function read(file: string): Testers {
  try {
    return storeOf(file).readSync()?.value ?? noTesters();
  } catch {
    return noTesters();
  }
}

const hashOf = (token: string): Buffer => crypto.createHash(TOKEN_HASH).update(token).digest();

export function addTester(file: string, name: unknown, now: () => Date = () => new Date()): { name: string; token: string } {
  const testerName = checkTesterName(name);
  const data = read(file);
  const token = crypto.randomBytes(TOKEN_BYTES).toString(TOKEN_ENCODING);
  data.testers[testerName] = { token, added: now().toISOString() };
  storeOf(file).writeSync(data);
  return { name: testerName, token };
}

export function removeTester(file: string, name: unknown): boolean {
  const testerName = checkTesterName(name);
  const data = read(file);
  if (!data.testers[testerName]) return false;
  delete data.testers[testerName];
  storeOf(file).writeSync(data);
  return true;
}

export const listTesters = (file: string): TesterRow[] => Object.entries(read(file).testers).map(([name, tester]) => ({ name, added: tester.added ?? '' }));

export function findTester(file: string, token: unknown): Tester | null {
  if (typeof token !== 'string' || !token) return null;
  const wanted = hashOf(token);
  let found: Tester | null = null;
  for (const [name, tester] of Object.entries(read(file).testers)) {
    const matches = crypto.timingSafeEqual(wanted, hashOf(tester.token));
    if (matches && !found) found = { name };
  }
  return found;
}
