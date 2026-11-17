import vm from 'node:vm';
import v8 from 'node:v8';
import {
  BYTECODE_FLAG_HASH_OFFSET, BYTECODE_HASH_BYTES, BYTECODE_PLACEHOLDER_QUOTES, BYTECODE_SOURCE_HASH_OFFSET,
} from './constants.ts';
import { BYTECODE_PLACEHOLDER_CHARACTER, BYTECODE_PLACEHOLDER_QUOTE, NO_FLUSH_BYTECODE_FLAG } from './keys.ts';
import { TEXT } from './text.ts';

export type ModuleScope = Readonly<{ exports: unknown; require: NodeJS.Require; module: unknown; filename: string; dirname: string }>;
type WrappedModule = (exports: unknown, require: NodeJS.Require, module: unknown, filename: string, dirname: string) => unknown;

const placeholder = (length: number): string => BYTECODE_PLACEHOLDER_QUOTE + BYTECODE_PLACEHOLDER_CHARACTER.repeat(Math.max(0, length - BYTECODE_PLACEHOLDER_QUOTES)) + BYTECODE_PLACEHOLDER_QUOTE;

function withThisEnginesFlags(bytecode: Buffer): Buffer {
  const sample = new vm.Script(placeholder(BYTECODE_PLACEHOLDER_QUOTES)).createCachedData();
  const fixed = Buffer.from(bytecode);
  sample.copy(fixed, BYTECODE_FLAG_HASH_OFFSET, BYTECODE_FLAG_HASH_OFFSET, BYTECODE_FLAG_HASH_OFFSET + BYTECODE_HASH_BYTES);
  return fixed;
}

export function runBytecode(bytecode: Buffer, filename: string, scope: ModuleScope): unknown {
  v8.setFlagsFromString(NO_FLUSH_BYTECODE_FLAG);
  const cachedData = withThisEnginesFlags(bytecode);
  const sourceLength = cachedData.readUInt32LE(BYTECODE_SOURCE_HASH_OFFSET);
  const script = new vm.Script(placeholder(sourceLength), { filename, cachedData });
  if (script.cachedDataRejected) throw new Error(TEXT.bytecodeRejected(filename));
  const wrapped = script.runInThisContext() as WrappedModule;
  return wrapped.call(scope.exports, scope.exports, scope.require, scope.module, scope.filename, scope.dirname);
}
