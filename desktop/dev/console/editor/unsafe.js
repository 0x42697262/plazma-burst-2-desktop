// "editor livewalls": walls moved in the running level as you drag them, by writing the
// wall arrays the game's integrity check snapshots. The game notices: it reports the
// client to the server and reloads the page. Nothing here hides the write. Off unless
// turned on in this session (it is never saved).
let on = false;

export const liveWallsOn = () => on;
export function setLiveWalls(value) { on = !!value; }
