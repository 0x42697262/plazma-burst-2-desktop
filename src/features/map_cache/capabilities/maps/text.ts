export const TEXT = Object.freeze({
  listNone: 'No maps in data/maps. Add <name>.xml there.',
  listTitle: 'Local maps (type the ID in Campaign > Custom Map):',
  listRow: (id: string) => `  ${id}`,
  listFailed: 'error: could not list maps (desktop wrapper only)',
  usage: 'maps',
  description: 'List local maps in data/maps (play via Campaign > Custom Map). Downloaded maps are saved there too ("save_maps", "fast load maps on")',
  about: [
    'The maps in data/maps. Play one from Campaign > Custom Map by typing the',
    'ID listed here. Maps the game downloads land there too, uncompressed and one',
    'XML tag per line.',
  ],
  notes: ['Desktop wrapper only: it asks the wrapper for the directory listing.'],
  see: ['save_maps', 'fast_maps'],
});
