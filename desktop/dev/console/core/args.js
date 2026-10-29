// Linux-style options for commands whose words could also be a character name:
// "--all" is an option, a bare "--" ends the options, and every other word is taken as
// written. So "trace all" traces a player named "all", and "trace --all" traces everyone.

// names: the options this command knows, without "--". Returns the options given (a Set)
// and the other words in order; `literal` is true when a "--" ended the options.
export function takeOptions(args, names) {
  const options = new Set();
  const rest = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '--') return { options, rest: rest.concat(args.slice(k + 1)), literal: true };
    if (a.startsWith('--')) {
      const name = a.slice(2).toLowerCase();
      if (!names.includes(name)) {
        throw new Error(`unknown option "${a}"${names.length ? `. Options: ${names.map((n) => `--${n}`).join(', ')}` : ''}. "-- ${a}" if it is a name.`);
      }
      options.add(name);
      continue;
    }
    rest.push(a);
  }
  return { options, rest, literal: false };
}

// The options that cannot go together.
export function oneOf(options, names) {
  const given = names.filter((n) => options.has(n));
  if (given.length > 1) throw new Error(`${given.map((n) => `--${n}`).join(' and ')} do not go together`);
  return given[0];
}
