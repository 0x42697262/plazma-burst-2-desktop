export const PAGE_ENTRIES = Object.freeze({ page: 'src/page/index.ts', console: 'src/console/index.ts' });
export const CHUNK_NAMES = 'chunks/[name]-[hash]';
export const BROWSER_TARGET = 'es2024';
export const WATCH_FLAG = '--watch';
export const NODE_TARGET = 'node22';
export const ELECTRON_MODULE = 'electron';
export const LAUNCHER_SCRIPT_FILE = 'launcher.js';
export const LAUNCHER_PRELOAD_FILE = 'preload.cjs';
export const EDITION_FLAG = '--edition';
export const FEATURES_FLAG = '--features';
export const FEATURE_LIST_SEPARATOR = ',';
export const EDITION_FILE_EXTENSION = '.json';
export const ONE_OFF_EDITION_NAME = 'custom';
export const EDITION_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
export const APP_ID_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
export const EDITION_MODULE = 'src/shared/editions/constants.ts';
export const CONSOLE_FEATURE_LIST = 'src/console/features.ts';
export const FEATURE_LIST_MODULES: readonly string[] = Object.freeze([CONSOLE_FEATURE_LIST, 'src/page/features.ts', 'src/wrapper/features.ts']);
export const FEATURE_IMPORT = /^import \{ (\w+)(?:, type \w+)* \} from '#features\/(\w+)\/[^']+';$/;
export const LIST_ENTRY = /^\s+(\w+),$/;
export const TYPESCRIPT_LOADER = 'ts';
export const EDITION_PLUGIN_NAME = 'edition';
export const LINE_BREAK = '\n';
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
export const exactPathFilter = (file: string): RegExp => new RegExp(`^${file.replace(REGEX_SPECIAL, '\\$&')}$`);
export const wholeWord = (name: string): RegExp => new RegExp(`\\b${name}\\b`);
export const FAILED_EXIT_CODE = 1;
export const ROOT_MODULE = 'src/kernel/config/root.ts';
export const PACKAGED_ROOT_MODULE = [
  "import path from 'node:path';",
  "import { app } from 'electron';",
  "export const APP_ROOT = path.join(__dirname, '..', '..');",
  'export const USER_ROOT = app.isPackaged ? app.getPath(\'userData\') : APP_ROOT;',
].join('\n');
export const WRAPPER_ENTRY = 'src/wrapper/main.ts';
export const WRAPPER_BUNDLE_FILE = 'main.cjs';
export const WRAPPER_TARGET = 'node24';
export const ROOT_PLUGIN_NAME = 'packaged-root';
export const CAPABILITY_IMPORT = /^import \{ (\w+) \} from '\.\/capabilities\/(\w+)\/[^']+';$/;
export const CAPABILITY_LIST_FILE = 'capabilities.ts';
export const FEATURES_FOLDER: readonly string[] = Object.freeze(['src', 'features']);
export const featureCapabilityListFilter = (featuresFolder: string): RegExp =>
  new RegExp(`^${featuresFolder.replace(REGEX_SPECIAL, '\\$&')}[\\\\/](\\w+)[\\\\/]capabilities\\.ts$`);
export const DEFAULTS_MODULE = 'src/shared/editions/defaults.ts';
export const COMMAND_CHAIN_SEPARATOR = ';';
export const COMMAND_QUOTE = '"';
export const COMMAND_WORDS = /\s+/;
export const OBFUSCATED_EXTENSIONS: readonly string[] = Object.freeze(['.js', '.cjs']);
export const NODE_EXTENSION = '.cjs';
export const SOURCE_MAP_EXTENSION = '.map';
export const OBFUSCATOR_OPTIONS = Object.freeze({
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayThreshold: 0.75,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
} as const);
