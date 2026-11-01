import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { jsCommand } from './entry/command.ts';

export const jsEvalConsole: ConsoleFeature = Object.freeze({ id: FEATURE.jsEval, commands: [jsCommand] });
