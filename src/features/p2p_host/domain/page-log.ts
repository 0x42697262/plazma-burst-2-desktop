import { HTML_ENTITIES, HTML_ENTITY, HTML_TAG, PAGE_ERROR_LEVEL, PAGE_TAG, PATH_SEPARATOR } from '../keys.ts';
import { HOST_LOG } from '../text.ts';

export type PageMessage = { message: string; level: string; sourceId?: string; lineNumber?: number };
export type PageLine = { level: 'info' | 'error' | 'debug'; text: string };

export const plainChat = (html: string): string => html.replace(HTML_TAG, '').replace(HTML_ENTITY, (entity) => HTML_ENTITIES[entity] ?? entity);

export function pageLine({ message, level, sourceId, lineNumber = 0 }: PageMessage): PageLine {
  if (message.startsWith(PAGE_TAG.console)) return { level: 'info', text: message.slice(PAGE_TAG.console.length) };
  if (message.startsWith(PAGE_TAG.chat)) return { level: 'info', text: HOST_LOG.chat(plainChat(message.slice(PAGE_TAG.chat.length))) };
  const source = sourceId ? HOST_LOG.pageSource(sourceId.split(PATH_SEPARATOR).pop() ?? '', lineNumber) : '';
  return level === PAGE_ERROR_LEVEL
    ? { level: 'error', text: HOST_LOG.pageError(message, source) }
    : { level: 'debug', text: HOST_LOG.pageOther(level, message, source) };
}
