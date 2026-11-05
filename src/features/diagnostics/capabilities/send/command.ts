import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND, ROUTE_OP } from '../../keys.ts';
import { postDiagnostics, readDiagnostics } from '../../adapters/route-client.ts';
import { SEND_INDENT, SEND_WORD } from './keys.ts';
import { SEND_TEXT as TEXT } from './text.ts';

type Config = { host: string | null; fields: string[]; auto: boolean; problems: string[] };
type Sent = { sent: number; pending: number; host: string | null; error?: string };

const printFailure = (error: Error): void => { print(TEXT.couldNot(error.message), COLOR.error); };
const printPayload = (payload: unknown): void => { print(JSON.stringify(payload, null, SEND_INDENT)); };
const preview = (): Promise<void> => postDiagnostics<unknown>({ op: ROUTE_OP.preview }).then(printPayload);

async function sendNow(): Promise<void> {
  const { sent, pending, host, error } = await postDiagnostics<Sent>({ op: ROUTE_OP.send });
  if (error) print(TEXT.failed(error, pending), COLOR.error);
  else if (!host) {
    print(TEXT.noServer, COLOR.notice);
    await preview();
  } else if (!sent) print(TEXT.nothing, COLOR.hint);
  else print(TEXT.sent(sent, pending, host), COLOR.ok);
}

function send(args: readonly string[]): Promise<void> {
  if (args.length > 1 || (args[0] && args[0].toLowerCase() !== SEND_WORD.preview)) throw new Error(TEXT.sendUsage);
  return (args.length ? preview() : sendNow()).catch(printFailure);
}

function config(): Promise<void> {
  return readDiagnostics<{ config: Config | null }>().then(({ config: values }) => {
    if (!values) return;
    print(TEXT.host(values.host), values.host ? COLOR.ok : COLOR.notice);
    print(TEXT.fields(values.fields));
    print(TEXT.auto(values.auto));
    for (const problem of values.problems) print(TEXT.problem(problem), COLOR.error);
  }, printFailure);
}

export const sendCommand = Object.freeze({ parent: COMMAND.name, name: SEND_WORD.send, usage: TEXT.sendUsage, desc: TEXT.sendDescription, help: { about: TEXT.sendAbout }, remote: false, run: send });
export const configCommand = Object.freeze({ parent: COMMAND.name, name: SEND_WORD.config, usage: TEXT.configUsage, desc: TEXT.configDescription, help: { about: TEXT.configAbout }, remote: false, run: config });
