import { z } from 'zod';
import { createVersionedFile, PersistError, type VersionedFile } from '#kernel/persist/versioned.ts';
import { SERVERS_FILE_MODE, SERVERS_FILE_VERSION } from '../constants.ts';
import { ENTRY_TEXT } from '../text.ts';
import { checkServer, storedServer, type ServerEntry } from '../domain/server.ts';

const serversFileSchema = z.object({ servers: z.array(z.unknown()), last: z.string().nullable() });
type ServersFile = z.infer<typeof serversFileSchema>;

export type LoadedServers = { servers: ServerEntry[]; last: string | null; problems: string[] };
export type ServersStore = { load(): LoadedServers; save(servers: readonly ServerEntry[], last: string | null): void; exists(): boolean };

const fromUnversioned = (data: Record<string, unknown>): Record<string, unknown> => ({
  servers: Array.isArray(data.servers) ? data.servers : [],
  last: typeof data.last === 'string' ? data.last : null,
});

export function createServersStore(file: string, newId: () => string, exists: (file: string) => boolean): ServersStore {
  const store: VersionedFile<ServersFile> = createVersionedFile<ServersFile>({
    file,
    version: SERVERS_FILE_VERSION,
    schema: serversFileSchema,
    migrations: { 0: fromUnversioned },
    fileMode: SERVERS_FILE_MODE,
  });

  function load(): LoadedServers {
    let read;
    try {
      read = store.readSync();
    } catch (error) {
      const message = error instanceof PersistError ? error.message : ENTRY_TEXT.fileProblem(file, (error as Error).message);
      return { servers: [], last: null, problems: [message] };
    }
    if (!read) return { servers: [], last: null, problems: [] };
    const servers: ServerEntry[] = [];
    const problems: string[] = [];
    read.value.servers.forEach((entry, index) => {
      const { server, errors } = checkServer(entry, newId, { nicknameOptional: true });
      if (server) servers.push(server);
      else problems.push(ENTRY_TEXT.entryProblem(index + 1, errors));
    });
    return { servers, last: read.value.last, problems };
  }

  const save = (servers: readonly ServerEntry[], last: string | null): void => store.writeSync({ servers: servers.map(storedServer), last: last || null });

  return { load, save, exists: () => exists(file) };
}
