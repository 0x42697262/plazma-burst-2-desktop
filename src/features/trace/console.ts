import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { NAME_WIDTH } from './constants.ts';
import { LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';
import { gameCharacters, traceOverlay } from './adapters/game-characters.ts';
import { createTracer } from './services/tracer.ts';
import { createTraceCommand, groupOptions } from './entry/command.ts';

export const tracer = createTracer(gameCharacters, traceOverlay);

export const traceConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.trace,
  commands: [createTraceCommand(tracer, gameCharacters)],
  listSections: {
    [LIST_SECTION]: () => {
      if (!tracer.isShown()) return null;
      const group = tracer.group();
      const now = gameCharacters.isLevelActive() ? tracer.tracedNow() : [];
      return [TEXT.listTitle(now.length, group ? groupOptions(group) : null), now.map((index) => TEXT.listRow(gameCharacters.label(index).padEnd(NAME_WIDTH), tracer.distanceTo(index)))] as const;
    },
  },
});
