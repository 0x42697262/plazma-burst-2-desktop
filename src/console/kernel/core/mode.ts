import { makeRedactor, type Redactor } from '../redaction/redactor.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import type { FeatureId } from '#shared/features/keys.ts';
import { isFeatureOn } from '../../flags.ts';
import { PAGE_GLOBAL } from '../../keys.ts';

export type ServerPage = Readonly<{ match: Readonly<Record<string, unknown>>; server: Readonly<Record<string, unknown>> }>;
export type Availability = Readonly<{ name?: string; remote?: boolean; server?: boolean; feature?: FeatureId }>;

const pageGlobal = (name: string): unknown => Reflect.get(globalThis, name);

export const REMOTE = pageGlobal(PAGE_GLOBAL.remote) === true;
export const SERVER = (pageGlobal(PAGE_GLOBAL.server) ?? null) as ServerPage | null;

const pageNames = (pageGlobal(PAGE_GLOBAL.names) ?? {}) as Readonly<Record<string, unknown>>;

export const redact: Redactor = REMOTE ? makeRedactor(pageNames) : stringOf;

export const allowedHere = (definition: Availability): boolean => {
  const isHiddenFromTesters = REMOTE && definition.remote === false;
  const isOnlyForTheHost = definition.server === true && !SERVER;
  const isFeatureOff = definition.feature !== undefined && !isFeatureOn(definition.feature);
  return !isHiddenFromTesters && !isOnlyForTheHost && !isFeatureOff;
};
