// The game clients this repository supports, and which one a command is for.
//
//   official  Plazma Burst 2, www.plazmaburst2.com/h5/ (the default everywhere)
//   sadburst  Sad Burst 2, sadburst2.com/gameplay/: a community fork of the official client
//             with its own servers and accounts. Same obfuscated names, but bundled and
//             minified, and loaded from a manifest of hashed script files.
//
// Every command is for the official client unless asked:
//   npm run fetch-game -- --sadburst   (the "--" passes the flag to the script; npm 12
//                                       refuses "npm run fetch-game --sadburst" as an
//                                       unknown npm option, older npm turns it into
//                                       npm_config_sadburst, which is read too)
//   npm run sadburst                   (the game window: electron . --sadburst)
// So running the usual commands never touches the Sad Burst files.
'use strict';

const path = require('path');

const REPO = path.join(__dirname, '..');
const DEV = path.join(__dirname, 'dev');

const CLIENTS = Object.freeze({
  official: Object.freeze({
    id: 'official',
    title: 'Plazma Burst 2',
    gameDir: path.join(REPO, 'game'),
    names: path.join(DEV, 'names.js'),
    opcodes: path.join(DEV, 'opcodes.js'),
    fetchFlag: '',
  }),
  sadburst: Object.freeze({
    id: 'sadburst',
    title: 'Sad Burst 2',
    site: 'https://sadburst2.com',
    host: 'sadburst2.com',
    prefix: '/gameplay/', // the game page; the rest of the site (login, API) is not the game
    gameDir: path.join(REPO, 'game.sadburst'),
    names: path.join(DEV, 'names.sadburst.js'),
    opcodes: path.join(DEV, 'opcodes.sadburst.js'),
    // Its map editor bundles lib_params.js into one script.
    editorScript: 'https://sadburst2.com/map_editor/scripts/ale/ale-all.js',
    fetchFlag: ' --sadburst',
  }),
});

const FLAG = '--sadburst';

// npm turns "npm run x --sadburst" into npm_config_sadburst ("true", or "" on some npm
// versions); "npm run x -- --sadburst" passes the flag on.
function wantsSadburst(argv = process.argv, env = process.env) {
  if (argv.includes(FLAG)) return true;
  const v = env.npm_config_sadburst;
  return v !== undefined && v !== 'false' && v !== '0';
}

const clientFor = (argv = process.argv, env = process.env) => (wantsSadburst(argv, env) ? CLIENTS.sadburst : CLIENTS.official);

// The arguments without the client flag, for scripts that parse their own.
const withoutClientFlag = (args) => args.filter((a) => a !== FLAG);

module.exports = { CLIENTS, FLAG, wantsSadburst, clientFor, withoutClientFlag };
