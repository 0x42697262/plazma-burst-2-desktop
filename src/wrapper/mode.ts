import { MODE } from '#shared/features/keys.ts';
import type { WrapperContext } from './context.ts';
import { WRAPPER_PARTS } from './features.ts';

export const isLauncherMode = ({ environment, flags }: Pick<WrapperContext, 'environment' | 'flags'>): boolean => (
  environment.mode === MODE.local && flags.server_list.on && WRAPPER_PARTS.serverListPart !== undefined
);
