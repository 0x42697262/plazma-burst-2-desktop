import { readerSource, writerSource } from './keys.ts';

type Reader = () => unknown;
type Writer = (value: unknown) => void;

const readers = new Map<string, Reader>();
const writers = new Map<string, Writer>();

const compile = <Compiled>(source: string): Compiled => (0, eval)(source) as Compiled;

export function readGlobal(name: string): unknown {
  let reader = readers.get(name);
  if (!reader) {
    reader = compile<Reader>(readerSource(name));
    readers.set(name, reader);
  }
  return reader();
}

export function writeGlobal(name: string, value: unknown): void {
  let writer = writers.get(name);
  if (!writer) {
    writer = compile<Writer>(writerSource(name));
    writers.set(name, writer);
  }
  writer(value);
}
