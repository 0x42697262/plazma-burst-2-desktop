import { MAP_SEPARATOR } from '../keys.ts';
import type { ActiveProfile, ProfileContext } from '../adapters/store.ts';

export type ProfileWatcherDeps = {
  context: Pick<ProfileContext, 'currentMap' | 'active' | 'isLevelActive' | 'run'>;
  joined: (map: string, profile: ActiveProfile) => void;
  left: (map: string) => void;
  onloadSource: (name: string) => string;
};

export function createProfileWatcher({ context, joined, left, onloadSource }: ProfileWatcherDeps) {
  let lastSeen = '';
  let wasActive = false;

  function tick(): void {
    const map = context.currentMap();
    const profile = context.active();
    const now = [map ?? '', profile?.name ?? ''].join(MAP_SEPARATOR);
    if (now !== lastSeen) {
      const hadProfile = lastSeen.split(MAP_SEPARATOR)[1];
      lastSeen = now;
      if (profile && map) joined(map, profile);
      else if (hadProfile && map) left(map);
    }
    const isActive = context.isLevelActive();
    const hasStarted = isActive && !wasActive;
    wasActive = isActive;
    if (hasStarted && profile?.onload) context.run(profile.onload, onloadSource(profile.name));
  }

  return { tick };
}
