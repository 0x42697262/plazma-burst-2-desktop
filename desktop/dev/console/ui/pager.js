// Long lists are built as rows first, then printed one page at a time, so the top of a
// list never scrolls out of the log. The last list is kept: "more" prints its next page,
// "page <n>" any page. A command also takes "page <n>" at its end: "triggers on page 3".
import { print } from './log.js';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { pluralSuffix } from '../../../../src/console/kernel/core/words.ts';
import { KEY } from '../../../../src/console/kernel/state/schema.ts';
import { settings } from '../../../../src/console/kernel/state/store.ts';

const PAGE_WORDS = ['page', 'pg'];
let pager = null; // { title, rows, cmd, hint, empty, color, page, pages, size }

// Removes a trailing "page <n>". Returns { args, page } (page 1 without one).
export function takePage(args) {
  const n = args.length;
  if (n >= 2 && PAGE_WORDS.includes(String(args[n - 2]).toLowerCase())) {
    if (!/^\d+$/.test(args[n - 1])) throw new Error('page expects a number, e.g. "page 2"');
    return { args: args.slice(0, n - 2), page: Number(args[n - 1]) };
  }
  return { args, page: 1 };
}

function printPage() {
  const { title, rows, cmd, hint, empty, color, page, pages, size } = pager;
  const from = (page - 1) * size;
  const slice = rows.slice(from, from + size);
  print(pages > 1 ? `${title} Page ${page}/${pages}: ${from + 1}-${from + slice.length} of ${rows.length}.` : title, color);
  if (!rows.length && empty) print(empty, COLOR.notice);
  for (const [text, c] of slice) print(text, c);
  if (pages > 1) {
    print(page < pages
      ? `Page ${page}/${pages}. "more" = next page, "page <n>" = jump (also "${cmd} page <n>").`
      : `Last page (${pages}/${pages}). "page 1" = back to the top.`, COLOR.hint);
  }
  if (hint) print(hint, COLOR.hint);
}

// rows: [text, color?] each. cmd: the command that made the list, for the footer.
// title: first line; hint: last line; empty: printed when there are no rows.
export function showPaged({ title, rows, cmd, hint = '', empty = '', color = COLOR.title, page = 1 }) {
  const size = settings.effective(KEY.PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  if (!Number.isInteger(page) || page < 1) throw new Error('pages start at 1');
  if (page > pages) throw new Error(`no page ${page}: this list has ${pages} page${pluralSuffix(pages)} of ${size}`);
  pager = { title, rows, cmd, hint, empty, color, page, pages, size };
  printPage();
}

// No page number: the next page. Otherwise that page of the last list.
export function turnPage(n) {
  if (!pager) throw new Error('no list to page yet. Try "triggers".');
  if (n !== undefined && !/^\d+$/.test(String(n))) throw new Error('usage: page <n>');
  const page = n === undefined ? pager.page + 1 : Number(n);
  if (n === undefined && page > pager.pages) throw new Error(`already on the last page (${pager.pages}/${pager.pages}). "page 1" goes back to the top.`);
  if (page < 1 || page > pager.pages) throw new Error(`no page ${page}: this list has ${pager.pages} page${pluralSuffix(pager.pages)}`);
  pager.page = page;
  printPage();
}
