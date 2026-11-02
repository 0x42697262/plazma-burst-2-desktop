export const DELETE_TEXT = Object.freeze({
  deleteUsage: 'usage: profile delete <name>',
  deleted: (name: string, maps: readonly string[]) => `Deleted profile "${name}"${maps.length ? `; ${maps.length} map${maps.length === 1 ? '' : 's'} no longer use it: ${maps.join(', ')}` : ''}`,
  usage: 'profile delete <name>',
  desc: 'Delete a profile; its maps use none',
  see: ['profile'],
});
