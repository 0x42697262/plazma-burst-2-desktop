export const TEXT = Object.freeze({
  count: (count: number, kind: string) => `${count} ${kind}`,
  partSeparator: ', ',
  title: (parts: string) => `editor: ${parts}`,
  where: (inLevel: boolean) => `  ${inLevel ? 'in the running level' : 'kept, not in the running level'}; put in again when the level starts over on this map`,
  reset: '  ("editor reset" undoes and forgets them)',
});
