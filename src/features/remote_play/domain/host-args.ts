import { HOST_DEFAULTS, HOST_LIMITS } from '../constants.ts';
import { HOST_ARG, HOST_ARG_PATTERN, PUBLIC_BIND, PUBLIC_FLAG, SIZE_PATTERN } from '../keys.ts';
import { TEXT } from '../text.ts';

export type HostOptions = { port: number; bind: string; maxGames: number; fps: number; quality: number; width: number; height: number };
type Limit = Readonly<{ min: number; max: number }>;

const isWithin = (value: number, limit: Limit): boolean => value >= limit.min && value <= limit.max;

export function parseHostArgs(args: readonly string[]): { options: HostOptions; problems: string[] } {
  const options: HostOptions = {
    port: HOST_DEFAULTS.port, bind: HOST_DEFAULTS.bind, maxGames: HOST_DEFAULTS.maxGames, fps: HOST_DEFAULTS.fps,
    quality: HOST_DEFAULTS.quality, width: HOST_DEFAULTS.width, height: HOST_DEFAULTS.height,
  };
  const problems: string[] = [];
  const wholeNumber = (text: string, limit: Limit, name: string): number | undefined => {
    const value = Number(text);
    if (Number.isInteger(value) && isWithin(value, limit)) return value;
    problems.push(TEXT.badWholeNumber(name, limit.min, limit.max));
    return undefined;
  };
  for (const arg of args) {
    if (arg === PUBLIC_FLAG) options.bind = PUBLIC_BIND;
    const match = HOST_ARG_PATTERN.exec(arg);
    if (!match) continue;
    const [, name = '', value = ''] = match;
    if (name === HOST_ARG.port) options.port = wholeNumber(value, HOST_LIMITS.port, name) ?? options.port;
    else if (name === HOST_ARG.bind) options.bind = value;
    else if (name === HOST_ARG.max) options.maxGames = wholeNumber(value, HOST_LIMITS.max, name) ?? options.maxGames;
    else if (name === HOST_ARG.fps) options.fps = wholeNumber(value, HOST_LIMITS.fps, name) ?? options.fps;
    else if (name === HOST_ARG.quality) options.quality = wholeNumber(value, HOST_LIMITS.quality, name) ?? options.quality;
    else if (name === HOST_ARG.size) {
      const size = SIZE_PATTERN.exec(value);
      const width = Number(size?.[1]);
      const height = Number(size?.[2]);
      if (size && isWithin(width, HOST_LIMITS.width) && isWithin(height, HOST_LIMITS.height)) {
        options.width = width;
        options.height = height;
      } else {
        problems.push(TEXT.badSize(HOST_LIMITS.width.min, HOST_LIMITS.height.min, HOST_LIMITS.width.max, HOST_LIMITS.height.max));
      }
    }
  }
  return { options, problems };
}
