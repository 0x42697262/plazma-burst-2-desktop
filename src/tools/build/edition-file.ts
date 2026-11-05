import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CATALOG } from '#shared/features/catalog.ts';
import { DIAGNOSTIC_FIELDS, EVERY_FEATURE } from '#shared/editions/keys.ts';
import { FEATURE } from '#shared/features/keys.ts';
import type { Edition } from '#shared/editions/types.ts';
import { EDITIONS_DIR, REPO_ROOT } from '#kernel/config/paths.ts';
import { resolveEdition, type EditionList } from '#kernel/editions/resolve.ts';
import { APP_ID_PATTERN, EDITION_FILE_EXTENSION, EDITION_NAME_PATTERN, ONE_OFF_EDITION_NAME } from './constants.ts';
import { TEXT } from './text.ts';
import { checkDefaults, type FingerprintOf, type ListedDefaults } from './edition-defaults.ts';
import type { EditionDefaults } from '#shared/editions/types.ts';

const editionFileSchema = z.object({
  name: z.string().regex(EDITION_NAME_PATTERN),
  title: z.string().min(1),
  appId: z.string().regex(APP_ID_PATTERN),
  features: z.union([z.literal(EVERY_FEATURE), z.array(z.string())]),
  diagnostics: z.object({
    hidden: z.boolean().optional(),
    host: z.string().optional(),
    send: z.array(z.enum(DIAGNOSTIC_FIELDS as readonly [string, ...string[]])).optional(),
    auto: z.boolean().optional(),
  }).strict().optional(),
  defaults: z.object({
    servers: z.array(z.object({ name: z.string().optional(), address: z.string(), fingerprint: z.string() }).strict()).optional(),
    binds: z.record(z.string(), z.string()).optional(),
    settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }).strict().optional(),
}).strict();

const withoutUnset = <Value extends Record<string, unknown>>(values: Value): Value => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Value;

export type BuiltEdition = Readonly<{ edition: Edition; missing: readonly string[]; problems: readonly string[]; listedDefaults: ListedDefaults }>;

const withFeatures = (base: Omit<Edition, 'features' | 'capabilities'>, listed: EditionList, listedDefaults: ListedDefaults = {}): BuiltEdition => {
  const resolved = resolveEdition(CATALOG, listed);
  const features = listed === EVERY_FEATURE ? null : resolved.features;
  return Object.freeze({ edition: Object.freeze({ ...base, features, capabilities: resolved.capabilities }), missing: resolved.missing, problems: resolved.problems, listedDefaults });
};

export function readEdition(name: string, folder: string = EDITIONS_DIR): BuiltEdition {
  const file = path.join(folder, name + EDITION_FILE_EXTENSION);
  const shown = path.relative(REPO_ROOT, file);
  let parsed: z.infer<typeof editionFileSchema>;
  try {
    parsed = editionFileSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    throw new Error(TEXT.editionUnreadable(shown, (error as Error).message), { cause: error });
  }
  if (parsed.name !== name) throw new Error(TEXT.nameMismatch(shown, parsed.name));
  const built = withFeatures({ name: parsed.name, title: parsed.title, appId: parsed.appId, ...(parsed.diagnostics ? { diagnostics: withoutUnset(parsed.diagnostics) } : {}) }, parsed.features, parsed.defaults);
  const hasDiagnostics = built.edition.features === null || built.edition.features.includes(FEATURE.diagnostics);
  if (!parsed.diagnostics || hasDiagnostics) return built;
  return Object.freeze({ ...built, missing: [...built.missing, FEATURE.diagnostics], problems: [...built.problems, TEXT.diagnosticsNeedsFeature] });
}

export const oneOffEdition = (features: readonly string[]): BuiltEdition =>
  withFeatures({ name: ONE_OFF_EDITION_NAME, title: TEXT.oneOffTitle, appId: TEXT.oneOffAppId }, features);

export const editionNames = (folder: string = EDITIONS_DIR): string[] =>
  fs.readdirSync(folder).filter((file) => file.endsWith(EDITION_FILE_EXTENSION)).map((file) => file.slice(0, -EDITION_FILE_EXTENSION.length)).sort();

export type ReadyEdition = Readonly<{ edition: Edition; defaults: EditionDefaults; missing: readonly string[]; problems: readonly string[] }>;

export async function readyEdition(built: BuiltEdition, fingerprintOf: FingerprintOf): Promise<ReadyEdition> {
  const checked = await checkDefaults(built.edition, built.listedDefaults, fingerprintOf);
  return Object.freeze({
    edition: built.edition,
    defaults: checked.defaults,
    missing: [...new Set([...built.missing, ...checked.missing])],
    problems: [...built.problems, ...checked.problems],
  });
}
