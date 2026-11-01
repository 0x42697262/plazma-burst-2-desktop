import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { NETLOG_DIR } from '#features/netlog/paths.ts';
import { redactLogFolder } from '#features/netlog/adapters/redact-files.ts';
import { TEXT } from './text.ts';

const report = await redactLogFolder(NETLOG_DIR);
console.log(TEXT.report(path.relative(REPO_ROOT, NETLOG_DIR), report.files, report.changedFiles, report.changedLines));
