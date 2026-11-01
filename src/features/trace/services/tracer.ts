import { DOWN_COLOR, EDGE, LINE_COLOR, LINE_WIDTH } from '../constants.ts';
import { LAYER, NO_ACCOUNT, TRACE_KIND, TRACE_SIDE, accountPerson, slotPerson, type TraceKind, type TraceSide } from '../keys.ts';
import { TEXT } from '../text.ts';
import { clampToScreen } from '../domain/screen-edge.ts';
import type { Character, GameCharacters, TraceOverlay, Transform } from '../adapters/game-characters.ts';

export type TraceGroup = Readonly<{ kind: TraceKind | null; side: TraceSide | null }>;
type Picks = { slots: Set<number>; people: Set<string> };

export function createTracer(characters: GameCharacters, overlay: TraceOverlay) {
  let group: TraceGroup | null = null;
  const picked: Picks = { slots: new Set(), people: new Set() };
  const dropped: Picks = { slots: new Set(), people: new Set() };

  const kindMatches: Readonly<Record<TraceKind, (character: Character) => boolean>> = {
    [TRACE_KIND.players]: (character) => characters.isHuman(character),
    [TRACE_KIND.npc]: (character) => !characters.isHuman(character),
  };
  const sideMatches: Readonly<Record<TraceSide, (character: Character, me: Character) => boolean>> = {
    [TRACE_SIDE.team]: (character, me) => character.team === me.team,
    [TRACE_SIDE.enemies]: (character, me) => character.team !== me.team,
  };

  function personOf(index: number, character: Character | null = characters.at(index)): string {
    const login = typeof character?.login === 'string' ? character.login : '';
    return NO_ACCOUNT.includes(login) ? slotPerson(index, character?.nickname) : accountPerson(login);
  }

  const isPicked = (picks: Picks, index: number, person: string): boolean => picks.slots.has(index) || picks.people.has(person);
  const isEmpty = (picks: Picks): boolean => !picks.slots.size && !picks.people.size;
  const clear = (picks: Picks): void => { picks.slots.clear(); picks.people.clear(); };

  function inGroup(character: Character, me: Character | null): boolean {
    if (!group) return false;
    const kindOk = !group.kind || kindMatches[group.kind](character);
    const sideOk = !group.side || (me !== null && sideMatches[group.side](character, me));
    return kindOk && sideOk;
  }

  function tracedNow(): number[] {
    const traced: number[] = [];
    const me = characters.player();
    const here = new Set<string>();
    for (let index = 0; index < characters.count(); index++) {
      const character = characters.at(index);
      if (index === characters.me() || !character) continue;
      const person = personOf(index, character);
      here.add(person);
      const isTraced = isPicked(picked, index, person) || (inGroup(character, me) && !isPicked(dropped, index, person));
      if (isTraced) traced.push(index);
    }
    let someoneLeft = false;
    for (const people of [picked.people, dropped.people]) {
      for (const person of people) {
        if (here.has(person)) continue;
        people.delete(person);
        someoneLeft = true;
      }
    }
    if (someoneLeft) queueMicrotask(refresh);
    return traced;
  }

  function distanceTo(index: number): number {
    const me = characters.player();
    const character = characters.at(index);
    if (!me || !character) return 0;
    return Math.round(Math.hypot(character.x - me.x, character.y - me.y));
  }

  function draw(context: CanvasRenderingContext2D, transform: Transform): unknown {
    const me = characters.player();
    if (!me) return null;
    const middle = (character: Character) => overlay.toScreen(transform, { x: character.x, y: character.y - characters.bodyMiddle });
    const from = middle(me);
    const items: { x: number; y: number; text: string }[] = [];
    context.lineWidth = LINE_WIDTH;
    for (const index of tracedNow()) {
      const character = characters.at(index);
      if (!character) continue;
      const to = middle(character);
      if (![to.x, to.y].every(Number.isFinite)) continue;
      const isDown = characters.isDown(character);
      context.strokeStyle = isDown ? DOWN_COLOR : LINE_COLOR;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      const at = clampToScreen(from, to, { width: overlay.width, height: overlay.height, edge: EDGE });
      items.push({ x: at.x, y: at.y, text: TEXT.label(characters.label(index, character), distanceTo(index), isDown) });
    }
    const labels = overlay.drawLabels(context, items, overlay.crosshair(transform), { w: overlay.width, h: overlay.height });
    return { lines: items.length, labels };
  }

  function refresh(): void {
    const isTracing = group !== null || !isEmpty(picked);
    overlay.setLayer(LAYER, isTracing ? draw : null);
  }

  function add(targets: readonly (readonly [number, boolean])[]): void {
    for (const [index, bySlot] of targets) {
      const person = personOf(index);
      if (bySlot) picked.slots.add(index);
      else picked.people.add(person);
      dropped.slots.delete(index);
      dropped.people.delete(person);
    }
    refresh();
  }

  function setGroup(next: TraceGroup): void {
    group = Object.freeze({ ...next });
    clear(dropped);
    refresh();
  }

  function remove(index: number, bySlot: boolean): void {
    const person = personOf(index);
    picked.slots.delete(index);
    picked.people.delete(person);
    if (group) {
      if (bySlot) dropped.slots.add(index);
      else dropped.people.add(person);
    }
    refresh();
  }

  function off(): void {
    group = null;
    clear(picked);
    clear(dropped);
    refresh();
  }

  return {
    tracedNow,
    distanceTo,
    add,
    setGroup,
    remove,
    off,
    group: (): TraceGroup | null => group,
    isPickedBySlot: (index: number): boolean => picked.slots.has(index),
    isShown: (): boolean => overlay.hasLayer(LAYER),
  };
}

export type Tracer = ReturnType<typeof createTracer>;
