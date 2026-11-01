import type { Edition } from '#shared/editions/types.ts';
import {
  DESKTOP_FILE_EXTENSION, FILE_NAME_JOIN, LINUX_CATEGORY, LINUX_TARGETS, PLATFORM, STAGED_FILES, STAGED_MAIN, UNSAFE_FILE_CHARACTER, WINDOWS_TARGETS,
  artifactName, type Platform,
} from './keys.ts';

export const fileNameOf = (title: string): string => title.replace(UNSAFE_FILE_CHARACTER, FILE_NAME_JOIN);

export type StagedPackage = Readonly<{ name: string; productName: string; version: string; description: string; author: string; desktopName: string; main: string; private: true }>;

export const stagedPackage = (edition: Edition, { version, description, author }: { version: string; description: string; author: string }): StagedPackage => Object.freeze({
  name: edition.appId,
  productName: edition.title,
  version,
  description,
  author,
  desktopName: edition.appId + DESKTOP_FILE_EXTENSION,
  main: STAGED_MAIN,
  private: true,
});

export function builderConfig({ edition, electronVersion, outDir, platforms }: {
  edition: Edition; electronVersion: string; outDir: string; platforms: readonly Platform[];
}) {
  return {
    appId: edition.appId,
    productName: edition.title,
    electronVersion,
    asar: true,
    publish: null,
    directories: { output: outDir },
    files: [...STAGED_FILES],
    artifactName: artifactName(fileNameOf(edition.title)),
    ...(platforms.includes(PLATFORM.linux) ? { linux: { target: [...LINUX_TARGETS], category: LINUX_CATEGORY, syncDesktopName: true } } : {}),
    ...(platforms.includes(PLATFORM.windows) ? { win: { target: [...WINDOWS_TARGETS] } } : {}),
  };
}
