import { CATALOG } from '#shared/features/catalog.ts';
import type { FlagStates } from '#shared/features/types.ts';
import { parseEnvironment, type Environment } from '#kernel/config/environment.ts';
import { FEATURES_FILE } from '#kernel/config/paths.ts';
import { TEXT as CONFIG_TEXT } from '#kernel/config/text.ts';
import { featuresFileStore, splitKnownFeatures, type FileOverrides } from '#kernel/flags/features-file.ts';
import { explicitlySet, resolveFlags } from '#kernel/flags/resolve.ts';
import { KERNEL_EVENT } from '#kernel/log/events.ts';
import { LOG_LEVEL } from '#kernel/log/constants.ts';
import { createLogger, type Logger } from '#kernel/log/logger.ts';
import { FAILED_EXIT_CODE } from './constants.ts';
import { TEXT } from './text.ts';

export type WrapperContext = Readonly<{ environment: Environment; flags: FlagStates; log: Logger }>;


function readFeaturesFile(problems: string[]): FileOverrides {
  try {
    return splitKnownFeatures(featuresFileStore(FEATURES_FILE).readSync()?.value ?? null);
  } catch (error) {
    problems.push(TEXT.flagsFileUnreadable((error as Error).message));
    return splitKnownFeatures(null);
  }
}

function stopWith(problems: readonly string[]): never {
  console.error(CONFIG_TEXT.problemReport(problems));
  process.exit(FAILED_EXIT_CODE);
}

function buildContext(): WrapperContext {
  const { environment, problems: environmentProblems } = parseEnvironment(process.argv, process.env);
  const problems = [...environmentProblems];
  const fileFlags = readFeaturesFile(problems);
  const { states, problems: flagProblems } = resolveFlags({
    catalog: CATALOG,
    fileOverrides: fileFlags.overrides,
    fileUnknownIds: fileFlags.unknownIds,
    envToggles: environment.featureToggles,
    mode: environment.mode,
    client: environment.client,
  });
  problems.push(...flagProblems);
  if (problems.length) stopWith(problems);
  const log = createLogger(environment.logLevel, console, environment.logFormat);
  const setFlags = explicitlySet(CATALOG, states);
  if (Object.keys(setFlags).length) log.event(LOG_LEVEL.info, KERNEL_EVENT.flagsResolved, setFlags);
  return Object.freeze({ environment, flags: states, log });
}

export const wrapperContext: WrapperContext = buildContext();
