import type { Target } from '../domain/request.ts';
import { TARGET_KIND } from '../keys.ts';

export type MatchLike = Readonly<{ title: string; map_id: string }>;
export type Reloaded = Readonly<{ ok: boolean; message: string }>;
export type UpdatePorts<M extends MatchLike = MatchLike> = Readonly<{
  update(id: string): Promise<string>;
  reload(match: M): Promise<Reloaded>;
  tell(match: M, text: string): void;
}>;
export type UpdateReport = Readonly<{ id: string; reloaded: string[]; failed: { title: string; message: string }[] }>;

export function matchesToReload<M extends MatchLike>(target: Target, now: boolean, all: readonly M[], findMatch: (word: string) => M): M[] {
  if (!now) return [];
  if (target.kind === TARGET_KIND.match) return [findMatch(target.word)];
  const wanted = target.id.toLowerCase();
  return all.filter((match) => match.map_id.toLowerCase() === wanted);
}

export async function updateMap<M extends MatchLike>(ports: UpdatePorts<M>, id: string, toReload: readonly M[], notice: string): Promise<UpdateReport> {
  await ports.update(id);
  const reloaded: string[] = [];
  const failed: { title: string; message: string }[] = [];
  for (const match of toReload) {
    ports.tell(match, notice);
    const result = await ports.reload(match);
    if (result.ok) reloaded.push(match.title);
    else failed.push({ title: match.title, message: result.message });
  }
  return { id, reloaded, failed };
}
