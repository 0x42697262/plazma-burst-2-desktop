export type ListSection = () => readonly [string, readonly string[]] | null | false | 0 | undefined;

const sections = new Map<string, ListSection>();

export function registerListSection(name: string, make: ListSection): void {
  sections.set(name, make);
}

export const listSections = (): ReadonlyMap<string, ListSection> => sections;
