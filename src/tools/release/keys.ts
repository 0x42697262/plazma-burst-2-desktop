export const ARG = Object.freeze({ edition: '--edition', linux: '--linux', windows: '--windows', publicUrl: '--public-url', help: '--help' });
export const PLATFORM = Object.freeze({ linux: 'linux', windows: 'windows' });
export type Platform = typeof PLATFORM[keyof typeof PLATFORM];
export const LINUX_TARGETS: readonly string[] = Object.freeze(['AppImage']);
export const WINDOWS_TARGETS: readonly string[] = Object.freeze(['nsis', 'portable']);
export const RELEASE_FOLDER = 'release';
export const STAGING_FOLDER = 'app';
export const STAGED_MAIN = 'dist/wrapper/main.cjs';
export const STAGED_FILES: readonly string[] = Object.freeze(['dist/**/*', '!dist/**/*.map', 'package.json']);
export const PACKAGE_FILE = 'package.json';
export const DIST_FOLDER = 'dist';
export const SOURCE_MAP_SUFFIX = '.map';
export const artifactName = (fileName: string): string => `${fileName}-\${version}-\${os}-\${arch}.\${ext}`;
export const UNSAFE_FILE_CHARACTER = /[^A-Za-z0-9._-]+/g;
export const FILE_NAME_JOIN = '-';
export const LINUX_CATEGORY = 'Game';
export const DESKTOP_FILE_EXTENSION = '.desktop';
export const NEVER_PUBLISH = 'never' as const;
export const ELECTRON_PACKAGE: readonly string[] = Object.freeze(['node_modules', 'electron', 'package.json']);
export const LINE_JOIN = '\n';
export const SERVER_TEMPLATES_FOLDER: readonly string[] = Object.freeze(['src', 'tools', 'release', 'server-bundle']);
export const SERVER_TEMPLATE_FILES: readonly string[] = Object.freeze(['Dockerfile', 'compose.yml', 'Caddyfile', 'README.md']);
export const SERVER_EMPTY_FOLDERS: readonly string[] = Object.freeze(['game', 'certs', 'secrets', 'data/server', 'data/maps']);
export const SERVER_EXAMPLE_FILE = 'server.example.json';
export const GAME_FOLDER = 'game';
export const TEMPLATE_MARK = (key: string): string => `{{${key}}}`;
export const TEMPLATE_KEY = Object.freeze({ title: 'title', name: 'name', domain: 'domain', cloudflareRanges: 'cloudflare_ranges', gameStep: 'game_step' });
export const ARCHIVE_EXTENSION = '.tar.gz';
export const TAR_COMMAND = 'tar';
export const tarArguments = (archive: string, parent: string, folder: string): string[] => ['-czf', archive, '-C', parent, folder];
export const RANGE_SEPARATOR = ' ';
export const CLOUDFLARE_RANGES: readonly string[] = Object.freeze([
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20',
  '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
]);
export const TEXT_ENCODING = 'utf8';
export const LINE_END = '\n';
