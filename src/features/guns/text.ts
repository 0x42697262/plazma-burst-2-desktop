export const TEXT = Object.freeze({
  noGunNumber: (number: number) => `no gun #${number}. Type "guns".`,
  noGunMatches: (query: string) => `no gun matches "${query}". Type "guns".`,
  ambiguous: (query: string, count: number, models: string, more: boolean) => `"${query}" matches ${count} guns: ${models}${more ? ', ...' : ''}`,
});
