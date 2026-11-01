import { EDITED_NAME, HIDDEN_PREFIX, LOCAL_MAP_PREFIX } from '../keys.ts';

export { mapFileName } from '#kernel/maps/file-name.ts';
export const isLocalMapId = (id: string): boolean => id.toLowerCase().startsWith(LOCAL_MAP_PREFIX);
export const localNameOf = (id: string): string => id.slice(LOCAL_MAP_PREFIX.length);
export const localMapId = (name: string): string => LOCAL_MAP_PREFIX + name;
export const isEditedName = (name: string | null | undefined): name is string => EDITED_NAME.test(name ?? '') && !(name ?? '').startsWith(HIDDEN_PREFIX);
