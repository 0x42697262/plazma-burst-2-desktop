import { Module } from 'node:module';
import vm from 'node:vm';
import v8 from 'node:v8';
import { EAGER_COMPILE_FLAG } from './keys.ts';

export function compileToBytecode(source: string, filename: string): Buffer {
  v8.setFlagsFromString(EAGER_COMPILE_FLAG);
  return new vm.Script(Module.wrap(source), { filename }).createCachedData();
}
