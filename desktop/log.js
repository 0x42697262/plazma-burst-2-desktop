// The server's log until it moves to src/ (docs/refactor/progress.md, P5): the kernel's
// logger and log level parsing (src/kernel/log/, src/kernel/config/log-level.ts).
'use strict';

const { createLogger } = require('../src/kernel/log/logger.ts');
const { parseLogLevel } = require('../src/kernel/config/log-level.ts');
const { LOG_LEVELS, DEFAULT_LOG_LEVEL } = require('../src/kernel/log/constants.ts');

module.exports = {
  LEVELS: LOG_LEVELS,
  DEFAULT_LEVEL: DEFAULT_LOG_LEVEL,
  parseLogLevel: (argv = process.argv, env = process.env) => parseLogLevel(argv, env),
  createLogger,
};
