// The game's network text, decoded (scripts/connection.js; ANTICHEAT.md §13.3): packet
// fields split by \x01, message parts split by \x02 (escaped "$.1" / "$.2" inside), and
// numbers written in base N with the game's digits (net.netDigits: the characters 1-126
// except a few, so they look like control characters, letters and punctuation).

export const FIELD = '\x01';
export const PART = '\x02';
const ESC_FIELD = '$.1';
const ESC_PART = '$.2';
export const PART_CHARS_MAX = 2000; // a longer part (a map chunk, a match list) is cut

export const unescField = (s) => s.split(ESC_FIELD).join(FIELD);
export const unescPart = (s) => s.split(ESC_FIELD).join(FIELD).split(ESC_PART).join(PART);
export const splitParts = (data) => data.split(PART).map(unescPart);

// A number in the game's digits, or null when the text is not one.
export function decodeNumber(text, digits) {
  if (!digits || typeof text !== 'string' || !text) return null;
  const neg = text[0] === '-';
  if (neg && text.length === 1) return null;
  let n = 0;
  for (let i = neg ? 1 : 0; i < text.length; i++) {
    const d = digits.indexOf(text[i]);
    if (d < 0) return null;
    n = n * digits.length + d;
  }
  return neg ? -n : n;
}

const CONTROL = /[\x00-\x1f\x7f]/;
const isJson = (p) => {
  if (!/^[[{]/.test(p)) return false;
  try { JSON.parse(p); return true; } catch { return false; }
};
// A part as it is shown: a bare number for an encoded number (control characters and only
// digits, or a part that is always a number), JSON as it is, any other text in quotes.
export function showPart(p, digits, isNumber = false) {
  if (isNumber || CONTROL.test(p)) {
    const n = decodeNumber(p, digits);
    if (n !== null) return String(n);
  }
  if (p.length > PART_CHARS_MAX) return `${JSON.stringify(p.slice(0, PART_CHARS_MAX))}...(${p.length} chars)`;
  return isJson(p) ? p : JSON.stringify(p);
}
