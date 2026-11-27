import { stringOf } from '#kernel/text/text-of.ts';
import { MILLISECONDS } from '../constants.ts';
import { REPLY_OK, REPLY_PART } from '../keys.ts';
import { DURATION } from '../text.ts';

export type Own = Readonly<{ reputation: unknown; potential: unknown; skill: unknown; wins: unknown; losses: unknown }>;
export type ListReply = Readonly<{ ok: boolean; reason: string; rows: unknown[]; own: Own | null }>;
export type Relation = Readonly<{ mine: boolean; from: string; to: string; fit: boolean; delta: unknown; since: number; until: number; active: boolean }>;

type Bag = Record<string, unknown>;
const isBag = (value: unknown): value is Bag => !!value && typeof value === 'object' && !Array.isArray(value);

function parsed(text: unknown): unknown {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function listReplyOf(reply: unknown): ListReply {
  const parts = reply && typeof reply === 'object' ? Array.from(reply as ArrayLike<unknown>) : [];
  const ok = parts[REPLY_PART.status] === REPLY_OK;
  if (!ok) return { ok, reason: typeof parts[REPLY_PART.rows] === 'string' ? parts[REPLY_PART.rows] as string : '', rows: [], own: null };
  const rows = parsed(parts[REPLY_PART.rows]);
  const own = parsed(parts[REPLY_PART.own]);
  return {
    ok, reason: '', rows: Array.isArray(rows) ? rows : [],
    own: isBag(own) ? { reputation: own.reputation, potential: own.reputation_potential, skill: own.skill, wins: own.wins, losses: own.loses } : null,
  };
}

export function relationOf(row: unknown): Relation | null {
  if (!isBag(row)) return null;
  return {
    mine: !!row.is_mine, from: stringOf(row.from ?? ''), to: stringOf(row.to ?? ''), fit: !!row.is_support, delta: row.personal_delta,
    since: -Number(row.relative_since ?? 0), until: Number(row.relative_cap_time_until ?? 0), active: !!row.is_active,
  };
}

export function durationText(milliseconds: number): string {
  const total = Math.abs(milliseconds);
  const days = Math.floor(total / MILLISECONDS.day);
  const hours = Math.floor((total % MILLISECONDS.day) / MILLISECONDS.hour);
  const minutes = Math.floor((total % MILLISECONDS.hour) / MILLISECONDS.minute);
  if (days) return DURATION.daysHours(days, hours);
  if (hours) return DURATION.hoursMinutes(hours, minutes);
  return DURATION.minutes(minutes);
}
