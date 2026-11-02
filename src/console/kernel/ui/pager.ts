import { COLOR } from '../core/keys.ts';
import { pluralSuffix } from '../core/words.ts';
import { CORE_SETTING } from '../state/keys.ts';
import { settings } from '../state/store.ts';
import { PAGE_WORD_COUNT } from './constants.ts';
import { DIGITS_ONLY, PAGE_WORDS } from './keys.ts';
import { TEXT } from './text.ts';
import { print } from './log.ts';

export type Row = readonly [text: string, color?: string];
type PagedList = { title: string; rows: readonly Row[]; cmd: string; hint: string; empty: string; color: string; page: number; pages: number; size: number };
export type PagedRequest = { title: string; rows: readonly Row[]; cmd: string; hint?: string; empty?: string; color?: string; page?: number };

let pager: PagedList | null = null;

export function takePage(args: readonly string[]): { args: string[]; page: number } {
  const count = args.length;
  const pageWord = String(args[count - PAGE_WORD_COUNT] ?? '').toLowerCase();
  if (count >= PAGE_WORD_COUNT && PAGE_WORDS.includes(pageWord)) {
    const pageText = args[count - 1] ?? '';
    if (!DIGITS_ONLY.test(pageText)) throw new Error(TEXT.pageExpectsNumber);
    return { args: args.slice(0, count - PAGE_WORD_COUNT), page: Number(pageText) };
  }
  return { args: [...args], page: 1 };
}

function printPage(list: PagedList): void {
  const { title, rows, cmd, hint, empty, color, page, pages, size } = list;
  const from = (page - 1) * size;
  const slice = rows.slice(from, from + size);
  print(pages > 1 ? TEXT.pageTitle(title, page, pages, from + 1, from + slice.length, rows.length) : title, color);
  if (!rows.length && empty) print(empty, COLOR.notice);
  for (const [text, rowColor] of slice) print(text, rowColor);
  if (pages > 1) print(page < pages ? TEXT.pageFooter(page, pages, cmd) : TEXT.lastPageFooter(pages), COLOR.hint);
  if (hint) print(hint, COLOR.hint);
}

export function showPaged({ title, rows, cmd, hint = '', empty = '', color = COLOR.title, page = 1 }: PagedRequest): void {
  const size = settings.effective(CORE_SETTING.pageSize) as number;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  if (!Number.isInteger(page) || page < 1) throw new Error(TEXT.pagesStartAtOne);
  if (page > pages) throw new Error(TEXT.noPage(page, pages, pluralSuffix(pages), size));
  pager = { title, rows, cmd, hint, empty, color, page, pages, size };
  printPage(pager);
}

export function turnPage(requested?: string | number): void {
  if (!pager) throw new Error(TEXT.noListYet);
  if (requested !== undefined && !DIGITS_ONLY.test(String(requested))) throw new Error(TEXT.pageUsage);
  const page = requested === undefined ? pager.page + 1 : Number(requested);
  if (requested === undefined && page > pager.pages) throw new Error(TEXT.alreadyLastPage(pager.pages));
  if (page < 1 || page > pager.pages) throw new Error(TEXT.noPage(page, pager.pages, pluralSuffix(pager.pages)));
  pager.page = page;
  printPage(pager);
}
