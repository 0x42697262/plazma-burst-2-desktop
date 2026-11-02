import { CATALOG } from '#shared/features/catalog.ts';
import { CAPABILITY, FEATURE } from '#shared/features/keys.ts';
import type { DefaultServer, Edition, EditionDefaults } from '#shared/editions/types.ts';
import { checkServer } from '#features/server_list/domain/server.ts';
import { parseAddress } from '#features/server_list/domain/address.ts';
import { FETCH_FINGERPRINT_WORD } from '#features/server_list/keys.ts';
import { COMMAND_CHAIN_SEPARATOR, COMMAND_QUOTE, COMMAND_WORDS } from './constants.ts';
import { TEXT } from './text.ts';

export type ListedServer = Readonly<{ name?: string | undefined; address: string; fingerprint: string }>;
export type ListedDefaults = Readonly<{
  servers?: readonly ListedServer[] | undefined;
  binds?: Readonly<Record<string, string>> | undefined;
  settings?: Readonly<Record<string, string | number | boolean>> | undefined;
}>;
export type CheckedDefaults = Readonly<{ defaults: EditionDefaults; problems: readonly string[]; missing: readonly string[] }>;
export type FingerprintOf = (host: string, port: number) => Promise<string>;

type CommandNeeds = { own: string | null; subcommands: Map<string, string> };
type Definition = { name: string; aliases?: readonly string[]; capability?: string; container?: boolean; subcommands?: readonly Definition[] };

export const NO_DEFAULTS: EditionDefaults = Object.freeze({ servers: [], settings: {} });

const featureIds = new Set<string>(CATALOG.map((definition) => definition.id));

function hasId(edition: Edition, id: string): boolean {
  if (featureIds.has(id)) return edition.features === null || edition.features.includes(id as typeof edition.features[number]);
  return edition.capabilities === null || edition.capabilities.includes(id);
}

function splitChain(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  for (const character of text) {
    if (character === COMMAND_QUOTE) quoted = !quoted;
    if (character === COMMAND_CHAIN_SEPARATOR && !quoted) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  return [...parts, current].map((part) => part.trim()).filter(Boolean);
}

async function commandIndex(): Promise<Map<string, CommandNeeds>> {
  const { CONSOLE_FEATURES } = await import('#console/features.ts');
  const index = new Map<string, CommandNeeds>();
  for (const feature of CONSOLE_FEATURES) {
    for (const command of (feature.commands ?? []) as readonly Definition[]) {
      const subcommands = new Map<string, string>();
      for (const subcommand of command.subcommands ?? []) {
        for (const word of [subcommand.name, ...subcommand.aliases ?? []]) subcommands.set(word, subcommand.capability ?? feature.id);
      }
      const own = command.container ? null : command.capability ?? feature.id;
      for (const word of [command.name, ...command.aliases ?? []]) index.set(word, { own, subcommands });
    }
  }
  return index;
}

export async function checkDefaults(edition: Edition, listed: ListedDefaults, fingerprintOf: FingerprintOf): Promise<CheckedDefaults> {
  const problems: string[] = [];
  const missing = new Set<string>();
  const need = (id: string, problem: string): void => {
    if (hasId(edition, id)) return;
    missing.add(id);
    problems.push(problem);
  };

  const servers: DefaultServer[] = [];
  const listedServers = listed.servers ?? [];
  if (listedServers.length) need(FEATURE.serverList, TEXT.defaultsNeed(TEXT.serversWhat, FEATURE.serverList));
  for (const [position, entry] of listedServers.entries()) {
    const number = position + 1;
    if (entry.fingerprint.toLowerCase() === FETCH_FINGERPRINT_WORD) {
      try {
        const { host, port } = parseAddress(entry.address);
        problems.push(TEXT.fetchedFingerprint(number, entry.address, await fingerprintOf(host, port)));
      } catch (error) {
        problems.push(TEXT.fingerprintFailed(number, entry.address, (error as Error).message));
      }
      continue;
    }
    const { server, errors } = checkServer({ ...entry, nickname: '' }, () => '', { nicknameOptional: true });
    if (!server) problems.push(TEXT.serverProblem(number, errors));
    else servers.push({ name: server.name, address: server.address, fingerprint: server.fingerprint });
  }

  const listedBinds = Object.entries(listed.binds ?? {});
  const listedSettings = Object.entries(listed.settings ?? {});
  const settings: Record<string, unknown> = {};
  if (listedBinds.length || listedSettings.length) {
    const { parseKeyName } = await import('#console/kernel/state/key-names.ts');
    const { ALIASES, SCHEMA, parseValue } = await import('#console/kernel/state/schema.ts');
    const { FILE_SECTION } = await import('#console/kernel/state/keys.ts');
    const commands = await commandIndex();
    if (listedBinds.length) need(CAPABILITY.binds.bind, TEXT.defaultsNeed(TEXT.bindsWhat, CAPABILITY.binds.bind));
    const binds: Record<string, string> = {};
    for (const [written, command] of listedBinds) {
      let key: string;
      try {
        key = parseKeyName(written);
      } catch (error) {
        problems.push(TEXT.badKey(written, (error as Error).message));
        continue;
      }
      binds[key] = command.trim();
      for (const part of splitChain(command)) {
        const [word = '', next = ''] = part.toLowerCase().split(COMMAND_WORDS);
        const found = commands.get(word);
        if (!found) {
          problems.push(TEXT.unknownCommand(written, word));
          continue;
        }
        const needed = found.subcommands.get(next) ?? found.own;
        if (needed === null) problems.push(TEXT.onlySubcommands(written, word));
        else need(needed, TEXT.commandNeeds(written, part, needed));
      }
    }
    if (listedSettings.length) need(FEATURE.devConsole, TEXT.defaultsNeed(TEXT.settingsWhat, FEATURE.devConsole));
    for (const [written, value] of listedSettings) {
      const lowered = written.toLowerCase();
      const key = Object.hasOwn(SCHEMA, lowered) ? lowered : ALIASES[lowered];
      const spec = key === undefined ? undefined : SCHEMA[key];
      if (key === undefined || !spec) {
        problems.push(TEXT.unknownSetting(written));
        continue;
      }
      need(spec.capability ?? spec.feature, TEXT.settingNeeds(key, spec.capability ?? spec.feature));
      try {
        settings[key] = parseValue(key, value);
      } catch (error) {
        problems.push(TEXT.badSetting(key, (error as Error).message));
      }
    }
    if (Object.keys(binds).length) settings[FILE_SECTION.binds] = binds;
  }

  return Object.freeze({ defaults: Object.freeze({ servers, settings }), problems, missing: [...missing] });
}
