import { game, NET } from '../../../../desktop/dev/console/game/bindings.js';
import { isActive } from '../../../../desktop/dev/console/game/level.js';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';

type MapBindings = {
  isMP(): boolean; mapText(): unknown; matchMapId(): unknown; lobbyConnection(): Record<string, unknown> | null;
  sendMethodName(): string; messageType(name: string): unknown; clearMapChunks(): void; setMapText(text: string): void;
};

const bindings = game as unknown as MapBindings;
const keys = KEY as unknown as { SAVE_MAPS: string; FAST_MAPS: string };
const store = settings as unknown as { effective(key: string): unknown };
const messageNames = NET as unknown as Record<string, string>;

export const gameMaps = {
  isMP: (): boolean => bindings.isMP(),
  mapText: (): unknown => bindings.mapText(),
  matchMapId: (): unknown => bindings.matchMapId(),
  lobbyConnection: (): Record<string, unknown> | null => bindings.lobbyConnection(),
  sendMethodName: (): string => bindings.sendMethodName(),
  messageType: (name: string): unknown => bindings.messageType(messageNames[name] ?? name),
  clearMapChunks: (): void => bindings.clearMapChunks(),
  setMapText: (text: string): void => bindings.setMapText(text),
  isLevelActive: (): boolean => isActive(),
  isSaving: (): boolean => Boolean(store.effective(keys.SAVE_MAPS)),
  isFastLoading: (): boolean => store.effective(keys.FAST_MAPS) === true,
};

export type GameMaps = typeof gameMaps;
