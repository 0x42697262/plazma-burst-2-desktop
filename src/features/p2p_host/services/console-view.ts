import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { DIGITS_ONLY, NO_VALUE, SLOT_PREFIX, WHO_COLUMNS } from '../keys.ts';
import { COMMAND_TEXT as TEXT } from '../text.ts';
import { hostStatus, ownerCommand, playerName, roster, type RosterRow } from '../services/host.ts';

export function findPlayer(word: string | undefined): RosterRow {
  if (!word) throw new Error(TEXT.whichPlayer);
  const rows = roster().filter((row) => !row.self);
  const wanted = stringOf(word).replace(SLOT_PREFIX, '').toLowerCase();
  if (DIGITS_ONLY.test(wanted)) {
    const bySlot = rows.find((row) => row.slot === Number(wanted));
    if (bySlot) return bySlot;
  }
  const exact = rows.filter((row) => row.nickname.toLowerCase() === wanted || row.login.toLowerCase() === wanted);
  if (exact.length === 1 && exact[0]) return exact[0];
  const starting = rows.filter((row) => row.nickname.toLowerCase().startsWith(wanted) || row.login.toLowerCase().startsWith(wanted));
  if (starting.length === 1 && starting[0]) return starting[0];
  if (starting.length > 1) throw new Error(TEXT.couldBe(word, starting.map(playerName)));
  throw new Error(TEXT.noPlayer(word));
}

export function whoCells(row: RosterRow): string[] {
  return [
    String(row.slot),
    playerName(row) + (row.self ? TEXT.thisHost : '') + (row.guest ? TEXT.guest : ''),
    row.ping === undefined ? NO_VALUE : TEXT.pingMs(Math.round(row.ping as number)),
    row.spectator ? TEXT.spectator : stringOf(row.team ?? NO_VALUE),
    row.spectator ? NO_VALUE : String(Math.round((row.hp ?? 0) as number)),
    row.reputation === undefined ? NO_VALUE : stringOf(row.reputation),
  ];
}

export function printWho(): void {
  const rows = roster();
  const status = hostStatus();
  if (!status.match) {
    print(TEXT.noMatch(status.phase), COLOR.notice);
    return;
  }
  const players = rows.filter((row) => !row.spectator && !row.self).length;
  const spectating = rows.filter((row) => row.spectator && !row.self).length;
  print(TEXT.whoHead(players, status.match.players_max, spectating), COLOR.title);
  const lines = rows.map(whoCells);
  const widths = WHO_COLUMNS.map((heading, index) => Math.max(heading.length, ...lines.map((line) => (line[index] ?? '').length)));
  const formatRow = (cells: readonly string[]): string => TEXT.row(cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)));
  print(formatRow(WHO_COLUMNS), COLOR.hint);
  for (const line of lines) print(formatRow(line));
}

export const sendOwner = (text: string): void => {
  ownerCommand(text);
  print(TEXT.sent(text), COLOR.ok);
};

export const owner = (text: string) => (): void => sendOwner(text);
