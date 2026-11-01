export const TEXT_ENCODING = 'utf8';
export const PROGRESS_PAGE = (title: string): string => `data:text/html;charset=utf-8,${encodeURIComponent(
  `<!doctype html><title>${title}</title><body style="font:14px sans-serif;margin:24px;background:#111;color:#ddd">`
  + `<p id="line">…</p></body>`,
)}`;
export const showLineScript = (line: string): string => `document.getElementById('line').textContent = ${JSON.stringify(line)};`;
export const LINE_JOIN = '\n';
