import fs from 'node:fs';
import path from 'node:path';
import { runBytecode } from './platform/bytecode.ts';
import { BYTECODE_FILE } from './platform/keys.ts';

const bytecodeFile = path.join(__dirname, BYTECODE_FILE);
runBytecode(fs.readFileSync(bytecodeFile), bytecodeFile, { exports: module.exports, require, module, filename: __filename, dirname: __dirname });
