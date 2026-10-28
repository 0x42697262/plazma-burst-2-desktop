// Small text helpers shared by every command.

export const s = (n) => (n === 1 ? '' : 's');
export const plural = (n, noun) => `${n} ${noun}${s(n)}`;
export const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);
export const onOff = (v) => (v === true ? 'on' : v === false ? 'off' : String(v));

const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;
export const isNumberText = (t) => NUMBER_TEXT.test(String(t));

// "5" or "#5" -> 5; anything else -> null.
export const parseIndex = (t) => (/^#?\d+$/.test(String(t ?? '')) ? Number(String(t).replace('#', '')) : null);

export const escapeRe = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Text in quotes, shortened past `max` characters; any other value as it prints.
export const quote = (v, max = Infinity) => (typeof v === 'string'
  ? JSON.stringify(v.length > max ? v.slice(0, max) + '...' : v)
  : String(v));

export const stripHtml = (t) => String(t || '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

export const agoText = (ms) => (ms < 1000 ? 'now'
  : ms < 60000 ? `${(ms / 1000).toFixed(1)}s ago`
    : `${Math.floor(ms / 60000)}m ${Math.floor(ms % 60000 / 1000)}s ago`);

// The words "help" alone after a command: "tp help".
export const isHelpArg = (args) => args.length === 1 && args[0].toLowerCase() === 'help';
