import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { CONNECTION_KIND_COLUMN_WIDTH } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { usageError } from '../../text.ts';
import { lossText } from '../../domain/loss.ts';
import { recorder } from '../../services/page-recorder.ts';
import { statusHeaderParts, statusHints } from '../../services/status-lines.ts';
import { STATUS_TEXT as TEXT } from './text.ts';

function status(args: readonly string[]): void {
  if (args.length) throw new Error(usageError(TEXT.usage));
  const isOn = recorder.on();
  print([TEXT.header(isOn), ...statusHeaderParts()].join(TEXT.headerSeparator), isOn ? COLOR.ok : COLOR.notice);
  const writeError = recorder.writeError();
  if (writeError) print(TEXT.writeError(writeError), COLOR.error);
  else print(TEXT.file(recorder.file()), COLOR.hint);
  print(TEXT.pageLines(recorder.pageLines()), COLOR.hint);
  const connections = recorder.connections();
  if (!connections.length) print(isOn ? TEXT.noConnections : TEXT.offNothing, COLOR.hint);
  for (const connection of connections) {
    const totals = connection.total;
    const hasLoss = totals.slow || totals.stalled || totals.dropped || totals.gaps;
    print(TEXT.connection(
      connection.id, connection.kind.padEnd(CONNECTION_KIND_COLUMN_WIDTH), connection.connected, connection.ping, totals.pkOut, totals.pkIn,
      lossText(totals), connection.unacked, connection.missing,
    ), hasLoss ? COLOR.warn : COLOR.plain);
  }
  const hints = statusHints();
  if (hints.length) print(TEXT.footer(hints), COLOR.hint);
}

export const statusCommand = Object.freeze({
  parent: COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, examples: TEXT.examples, notes: TEXT.notes, see: TEXT.see },
  run: status,
});
