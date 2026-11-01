import { CHUNK_END, CHUNK_START, CHUNKED, HEADER_END, STATUS_OK } from '../keys.ts';
import { PROBE_TEXT } from '../text.ts';

export type ServerStatus = Record<string, unknown>;

export function parseStatusResponse(body: string): ServerStatus {
  const headerEnd = body.indexOf(HEADER_END);
  if (!STATUS_OK.test(body) || headerEnd < 0) throw new Error(PROBE_TEXT.noStatus);
  let text = body.slice(headerEnd + HEADER_END.length);
  if (CHUNKED.test(body.slice(0, headerEnd))) text = text.replace(CHUNK_START, '').replace(CHUNK_END, '');
  try {
    return JSON.parse(text) as ServerStatus;
  } catch {
    throw new Error(PROBE_TEXT.notJson);
  }
}
