// Example hook: when a level starts, prints your login, nickname and slot to the
// terminal running "npm start":
//   [hook log-player] {"login":"...","nickname":"...","slot":0,"multiplayer":true}
//
// To try it: copy this file to hooks/log-player.js and reload the game (Ctrl+R).
// Files ending in .example.js are templates and are never loaded.

module.exports.description = 'Logs your login, nickname and slot when a level starts';
// module.exports.multiplayer = false;   // uncomment: single-player only

// Game.levelStart is the game's function that builds a level from its map. Its real
// (obfuscated) name comes from desktop/dev/names.js, so this keeps working after game
// updates once "npm run find-names" has run.
Interceptor.attach(Game.levelStart, {
  // After the function: the level, and your character in it, exist now.
  onLeave() {
    const slot = Game.read('me');           // your index in the characters array
    const me = Game.read('chars')[slot];    // your character
    send({
      login: me?.login ?? null,             // empty in single-player when not logged in
      nickname: me?.nickname ?? null,
      slot,
      multiplayer: Game.isMP(),
    });
  },
});
