import { END_OF_OPTIONS, OPTION_PREFIX } from './keys.ts';
import { TEXT } from './text.ts';

export type TakenOptions = { options: Set<string>; rest: string[]; literal: boolean };

export function takeOptions(args: readonly string[], names: readonly string[]): TakenOptions {
  const options = new Set<string>();
  const rest: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === END_OF_OPTIONS) return { options, rest: rest.concat(args.slice(index + 1)), literal: true };
    if (arg.startsWith(OPTION_PREFIX)) {
      const name = arg.slice(OPTION_PREFIX.length).toLowerCase();
      if (!names.includes(name)) throw new Error(TEXT.unknownOption(arg, names));
      options.add(name);
      continue;
    }
    rest.push(arg);
  }
  return { options, rest, literal: false };
}

export type ValueOptions = TakenOptions & { values: Map<string, string[]> };

export function takeValueOptions(args: readonly string[], flags: readonly string[], valued: Readonly<Record<string, number>>): ValueOptions {
  const options = new Set<string>();
  const values = new Map<string, string[]>();
  const rest: string[] = [];
  const known = [...flags, ...Object.keys(valued)];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === END_OF_OPTIONS) return { options, values, rest: rest.concat(args.slice(index + 1)), literal: true };
    if (!arg.startsWith(OPTION_PREFIX)) {
      rest.push(arg);
      continue;
    }
    const name = arg.slice(OPTION_PREFIX.length).toLowerCase();
    if (!known.includes(name)) throw new Error(TEXT.unknownOption(arg, known));
    options.add(name);
    const count = Object.hasOwn(valued, name) ? valued[name] ?? 0 : 0;
    if (!count) continue;
    const taken = args.slice(index + 1, index + 1 + count);
    if (taken.length < count || taken.some((value) => value.startsWith(OPTION_PREFIX))) throw new Error(TEXT.needsValues(name, count));
    values.set(name, taken);
    index += count;
  }
  return { options, values, rest, literal: false };
}

export function oneOf(options: ReadonlySet<string>, names: readonly string[]): string | undefined {
  const given = names.filter((name) => options.has(name));
  if (given.length > 1) throw new Error(TEXT.notTogether(given));
  return given[0];
}
