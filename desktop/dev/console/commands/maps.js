// "maps": the maps in desktop/maps, listed by the desktop wrapper.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { ROUTE } from '../core/shared.js';

function listMaps() {
  fetch(ROUTE.maps, { cache: 'no-store' })
    .then((r) => r.json())
    .then((ids) => {
      if (!ids.length) { print('No maps in desktop/maps. Add <name>.xml there.', COLOR.notice); return; }
      print('Local maps (type the ID in Campaign > Custom Map):', COLOR.title);
      for (const id of ids) print(`  ${id}`);
    })
    .catch(() => print('error: could not list maps (desktop wrapper only)', COLOR.error));
}

export const mapsCommand = {
  name: 'maps',
  usage: 'maps',
  desc: 'List local maps in desktop/maps (play via Campaign > Custom Map). Downloaded maps are saved there too ("save_maps", "fast load maps on")',
  help: {
    about: [
      'The maps in desktop/maps. Play one from Campaign > Custom Map by typing the',
      'ID listed here. Maps the game downloads land there too, uncompressed and one',
      'XML tag per line.',
    ],
    notes: [
      'Desktop wrapper only: it asks the wrapper for the directory listing.',
    ],
    see: ['save_maps', 'fast_maps'],
  },
  run: listMaps,
};
