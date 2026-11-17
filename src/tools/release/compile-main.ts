import fs from 'node:fs';
import { compileToBytecode } from './bytecode.ts';
import { FIRST_USER_ARGUMENT } from './constants.ts';
import { TEXT } from './text.ts';

const [source, target] = process.argv.slice(FIRST_USER_ARGUMENT);
if (!source || !target) throw new Error(TEXT.compileUsage);
fs.writeFileSync(target, compileToBytecode(fs.readFileSync(source, 'utf8'), source));
