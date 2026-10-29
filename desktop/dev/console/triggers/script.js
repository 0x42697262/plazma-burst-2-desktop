// Triggers written as text, the way the map editor's "edit triggers as text" view shows
// them (lib_gui.js, CompileTrigger):
//   uid: #trigger*1016
//   enabled: true
//   maxcalls: -1
//
//   next if VarA == ValueB( "var_suddendeath", "1" );
//   MovableTo( "#door*13", "#region*306" );
//   op562( "a", "b" );
// An action line has '( "', '", "' and '" );'. Its name is everything before the first
// "(": the editor's alias for an action number, or "op<number>". A is the text between
// '( "' and the first '", "', B runs from there to the first '" );'. Nothing is escaped,
// so ""1"" is the value "1" with its quotes. Other lines are "uid", "enabled" or
// "maxcalls" headers, or empty.
// The editor reads each line as typed; here they are trimmed first. A script on one line
// (the console input has only one) also works: headers first, each action ending at its
// '" );'.
//
// The names come from desktop/dev/opcodes.js ("npm run fetch-opcodes").

const OPCODES = globalThis.PB2_OPCODES || null;
const HEADERS = Object.freeze(['uid', 'enabled', 'maxcalls']);
const OP_NUMBER = /^op(-?\d+)$/;
const ACTION_END = '" );';

export const opcodesLoaded = () => !!OPCODES;
// { desc, a, b, alias } for an action number, from the editor's list.
export const actionInfo = (type) => OPCODES?.actions?.[type];
export const opcodeName = (type) => actionInfo(type)?.alias || `op${type}`;

// An action name as the editor reads it: its number, or null.
function opcodeType(name) {
  const m = name.match(OP_NUMBER);
  if (m) return Number(m[1]);
  return OPCODES && Object.hasOwn(OPCODES.aliases, name) ? OPCODES.aliases[name] : null;
}

// Every known name that matches ignoring case and spaces: a hint for a typo.
function similarNames(name) {
  if (!OPCODES) return [];
  const squash = (s) => s.toLowerCase().replace(/\s+/g, '');
  return Object.keys(OPCODES.aliases).filter((a) => squash(a) === squash(name));
}

// A paste that is a trigger script, not commands.
export const looksLikeScript = (text) => /\(\s"/.test(text) && text.includes(ACTION_END);

// The lines the editor would see. A script on one line is cut after each '" );', with
// the headers before the first action split off.
function linesOf(text) {
  if (/[\r\n]/.test(text)) return text.split(/\r?\n/).map((line) => line.trim());
  let rest = text.trim();
  const lines = [];
  for (let m; (m = rest.match(/^(uid|enabled|maxcalls)\s*:\s*(\S*)\s*/i));) {
    lines.push(`${m[1]}: ${m[2]}`);
    rest = rest.slice(m[0].length);
  }
  for (let end; (end = rest.indexOf(ACTION_END)) !== -1;) {
    lines.push(rest.slice(0, end + ACTION_END.length).trim());
    rest = rest.slice(end + ACTION_END.length).trim();
  }
  if (rest) lines.push(rest);
  return lines;
}

// { headers: { uid?, enabled?, maxcalls? }, actions: [{ line, name, type, A, B }] }.
// Throws on the first line the editor would refuse, naming it.
export function parseScript(text) {
  const headers = {};
  const actions = [];
  linesOf(String(text)).forEach((line, i) => {
    const where = `line ${i + 1} "${line}"`;
    const start = line.indexOf('( "');
    const sep = line.indexOf('", "');
    const end = line.indexOf(ACTION_END);
    if (start !== -1 && sep !== -1 && end !== -1) {
      if (!(start < sep && sep < end)) throw new Error(`${where}: expected Name( "A", "B" );`);
      const name = line.slice(0, line.indexOf('(')).trim();
      const type = opcodeType(name);
      if (type === null) {
        const like = similarNames(name);
        const hint = like.length ? ` Did you mean ${like.join(' or ')}?`
          : !OPCODES ? ' Action names are not loaded: run "npm run fetch-opcodes", or write op<number>.'
            : ' "triggers actions <text>" searches the names.';
        throw new Error(`${where}: unknown action "${name}".${hint}`);
      }
      actions.push({ line: i + 1, name, type, A: line.slice(start + 3, sep), B: line.slice(sep + 4, end) });
    } else if (line.includes(':')) {
      const colon = line.indexOf(':');
      const key = line.slice(0, colon).trim().toLowerCase();
      if (!HEADERS.includes(key)) throw new Error(`${where}: "${key}" is not ${HEADERS.join(', ')}`);
      headers[key] = line.slice(colon + 1).trim();
    } else if (line) {
      throw new Error(`${where}: not an action (Name( "A", "B" );) or a header (${HEADERS.join(', ')})`);
    }
  });
  if (!actions.length) throw new Error('no actions in the script');
  return { headers, actions };
}

// Search the editor's action list: number, name or description words.
export function searchActions(q) {
  if (!OPCODES) return [];
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return Object.entries(OPCODES.actions)
    .map(([type, a]) => ({ type: Number(type), ...a }))
    .filter((a) => words.every((w) => String(a.type) === w || `${a.alias || ''} op${a.type} ${a.desc}`.toLowerCase().includes(w)))
    .sort((x, y) => x.type - y.type);
}
