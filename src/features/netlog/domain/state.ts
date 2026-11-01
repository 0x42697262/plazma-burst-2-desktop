import { decodeNumber, showPart, splitParts } from '#console/kernel/net/codec.ts';
import {
  BINARY_RADIX, EXTRA_STATE_LAYOUT, KNOWN_STATE_LAYOUT, KNOWN_STATE_PARTS, MILLISECONDS_PER_SECOND, POINT_SIZE,
  ROUNDING_FACTOR, SECONDS_DECIMALS, SHOT_SIZE, SNAPSHOT_STATS_COUNT, STATE_CLOCK_DECIMALS,
} from '../constants.ts';
import {
  KNOCKED_DOWN_MARKS, OTHER_MARKS, SNAPSHOT_HEADER_PREFIX, SNAPSHOT_PAUSED_PREFIX, SNAPSHOT_WAITING_PREFIX,
  STATE_KIND, STATE_LIST_SEPARATOR, type StateKind,
} from '../keys.ts';
import { STATE_TEXT } from '../text.ts';

export type StateLayout = Partial<Record<keyof typeof KNOWN_STATE_LAYOUT | 'velScale', number | null>>;
type Index = number | null | undefined;

const signed = (value: number): string => (value > 0 ? STATE_TEXT.positive(value) : String(value));
const roundHundredths = (value: number): number => Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR;
const isIndex = (index: Index): index is number => index !== null && index !== undefined;

function matchesKnownLayout(parts: readonly string[], layout: StateLayout): boolean {
  return parts.length === KNOWN_STATE_PARTS && Object.entries(KNOWN_STATE_LAYOUT).every(([key, index]) => layout[key as keyof StateLayout] === index);
}

export function describePlayerState(parts: readonly string[], digits: string, layout: StateLayout | null = {}): string {
  const positions = layout ?? {};
  const used = new Set<number>();
  const use = (index: Index): Index => { if (isIndex(index)) used.add(index); return index; };
  const numberAt = (index: Index): number | null => (isIndex(index) ? decodeNumber(parts[index], digits) : null);
  const isBlankAt = (index: Index): boolean => isIndex(index) && parts[index] === '';
  const out: string[] = [];

  const hpAt = use(positions.hp);
  const hp = numberAt(hpAt);
  if (isIndex(hpAt)) out.push(isBlankAt(hpAt) ? STATE_TEXT.hpBlank : STATE_TEXT.hp(hp));
  const respawns = numberAt(use(positions.respawns));
  if (respawns !== null) out.push(STATE_TEXT.respawns(respawns));
  const aimX = numberAt(use(positions.aimX));
  const aimY = numberAt(use(positions.aimY));
  if (aimX !== null || aimY !== null) out.push(STATE_TEXT.aim(signed(aimX ?? 0), signed(aimY ?? 0)));
  const positionX = numberAt(use(positions.x));
  const positionY = numberAt(use(positions.y));
  if (positionX !== null || positionY !== null) out.push(STATE_TEXT.position(positionX, positionY));

  const isKnownLayout = matchesKnownLayout(parts, positions);
  const head = numberAt(use(positions.headHp));
  const face = numberAt(use(positions.faceHp));
  if (isKnownLayout) {
    const scale = positions.velScale || 1;
    out.push(STATE_TEXT.velocity(roundHundredths((numberAt(use(EXTRA_STATE_LAYOUT.vx)) ?? 0) / scale), roundHundredths((numberAt(use(EXTRA_STATE_LAYOUT.vy)) ?? 0) / scale)));
    out.push(STATE_TEXT.bodyHp(head, face, numberAt(use(EXTRA_STATE_LAYOUT.armsHp)), numberAt(use(EXTRA_STATE_LAYOUT.legsHp))));
  } else if (head !== null || face !== null) {
    out.push(STATE_TEXT.headFace(head, face));
  }
  const killerOrCrouch = numberAt(use(positions.killer));
  if (killerOrCrouch !== null) {
    const isDead = hp !== null && hp <= 0;
    if (isDead) out.push(STATE_TEXT.killedBy(killerOrCrouch));
    else out.push(hp === null ? STATE_TEXT.crouchOrKiller(killerOrCrouch) : STATE_TEXT.crouch(killerOrCrouch));
  }
  if (isKnownLayout) {
    const marks = parts[EXTRA_STATE_LAYOUT.marks] ?? '';
    use(EXTRA_STATE_LAYOUT.marks);
    if (KNOCKED_DOWN_MARKS.has(marks)) out.push(STATE_TEXT.knockedDown);
    if (OTHER_MARKS.has(marks)) out.push(STATE_TEXT.otherMark);
    const gun = numberAt(use(EXTRA_STATE_LAYOUT.gun));
    out.push(gun === null ? STATE_TEXT.noGun : STATE_TEXT.gun(gun));
    const vehicle = numberAt(use(EXTRA_STATE_LAYOUT.vehicle));
    if (vehicle !== null) out.push(STATE_TEXT.vehicle(vehicle));
    const control = numberAt(use(EXTRA_STATE_LAYOUT.bodyControl));
    const points = parts[EXTRA_STATE_LAYOUT.points];
    use(EXTRA_STATE_LAYOUT.points);
    if (control !== null) {
      const values = points ? points.split(STATE_LIST_SEPARATOR).map((point) => decodeNumber(point, digits) ?? 0) : [];
      const groups: string[] = [];
      for (let index = 0; index + POINT_SIZE <= values.length; index += POINT_SIZE) groups.push(values.slice(index, index + POINT_SIZE).join(STATE_TEXT.pointSeparator));
      out.push(STATE_TEXT.limp(control, groups));
    }
    const flags = numberAt(use(EXTRA_STATE_LAYOUT.flags));
    if (flags) out.push(STATE_TEXT.flags(flags.toString(BINARY_RADIX)));
    const shots = parts[EXTRA_STATE_LAYOUT.shots];
    use(EXTRA_STATE_LAYOUT.shots);
    if (shots) out.push(STATE_TEXT.projectiles(Math.floor(shots.split(STATE_LIST_SEPARATOR).length / SHOT_SIZE)));
  }
  const clock = numberAt(use(positions.clock));
  if (clock !== null) out.push(STATE_TEXT.clock((clock / MILLISECONDS_PER_SECOND).toFixed(STATE_CLOCK_DECIMALS)));
  const rest: string[] = [];
  parts.forEach((part, index) => { if (!used.has(index) && part !== '') rest.push(STATE_TEXT.otherPart(index, showPart(part, digits))); });
  if (!isKnownLayout) rest.unshift(STATE_TEXT.notThisLayout(parts.length));
  if (rest.length) out.push(rest.join(STATE_TEXT.restSeparator));
  return out.join(STATE_TEXT.separator);
}

export function describeSnapshot(parts: readonly string[], digits: string, layout: StateLayout | null): string | null {
  let pointer = 0;
  const next = (): string | undefined => parts[pointer++];
  const head = next();
  if (head === undefined) return null;
  const isWaiting = head.startsWith(SNAPSHOT_WAITING_PREFIX);
  const isPaused = !isWaiting && head.startsWith(SNAPSHOT_PAUSED_PREFIX);
  const timer = decodeNumber(head.replace(SNAPSHOT_HEADER_PREFIX, ''), digits);
  const out: string[] = [];
  if (isWaiting) out.push(STATE_TEXT.waiting);
  if (isPaused) out.push(STATE_TEXT.paused);
  if (timer) out.push(STATE_TEXT.roundTimer((timer / MILLISECONDS_PER_SECOND).toFixed(SECONDS_DECIMALS)));
  while (pointer < parts.length) {
    const slot = decodeNumber(next(), digits);
    const hpText = next();
    const hp = hpText === '' ? 0 : decodeNumber(hpText, digits);
    const stats = (next() ?? '').split(STATE_LIST_SEPARATOR).map((part) => (part === '' ? 0 : decodeNumber(part, digits)));
    const countText = next();
    const count = countText === '' ? 0 : decodeNumber(countText, digits);
    const isMalformed = slot === null || hp === null || count === null || count < 0 || pointer + count > parts.length
      || stats.length !== SNAPSHOT_STATS_COUNT || stats.includes(null);
    if (isMalformed) return null;
    const state = parts.slice(pointer, pointer + count);
    pointer += count;
    out.push(STATE_TEXT.snapshotPlayer(slot, hp, stats[0] ?? 0, count ? describePlayerState(state, digits, layout) : ''));
  }
  return out.length ? out.join(STATE_TEXT.separator) : STATE_TEXT.nothingNew;
}

export function describeState(data: string, digits: string, kind: StateKind | null, layout: StateLayout | null): string {
  const parts = splitParts(data);
  if (kind === STATE_KIND.player) return describePlayerState(parts, digits, layout);
  if (kind === STATE_KIND.snapshot) {
    const snapshot = describeSnapshot(parts, digits, layout);
    if (snapshot !== null) return snapshot;
  }
  return STATE_TEXT.partByPart(parts.map((part) => showPart(part, digits)));
}
