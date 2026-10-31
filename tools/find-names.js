#!/usr/bin/env node
// Finds the obfuscated names the dev console needs in a downloaded game copy and writes
// them to desktop/dev/names.js.
//
// The game's identifiers are random look-alike names (e.g. $0Ме1А, with Cyrillic letters)
// that can change with every game version. The code structure around them is assumed to
// stay the same, so every name is found with a pattern that matches the surrounding code
// and treats all other obfuscated names as wildcards.
//
// Usage: node tools/find-names.js [gameDir] [--out file] [--check]
//        node tools/find-names.js [gameDir] --decode scripts/frame2.js > frame2.decoded.js
//   gameDir   folder with index.html, _strings.js and scripts/ (default: game/)
//   --out     output file (default: desktop/dev/names.js)
//   --check   only report, do not write
//   --decode  print a game file with its string constants filled in (for manual searching)
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const ID_CHARS = '0-9A-Za-z_\\u0400-\\u04FF';
const ID_RE = new RegExp(`\\$[${ID_CHARS}]+`, 'g');

// Code files the patterns search in. Keys are used in RULES below.
const FILES = {
  frame2: 'scripts/frame2.js',
  actions: 'scripts/actions.js',
  guns: 'scripts/guns.js',
  ui: 'scripts/ui.js',
  flash: 'scripts/libs/flash.js',
  tools: 'scripts/libs/tools.js',
};

// Each rule: `keys` are the names captured by ⟨ID⟩ in order ('_' = ignore), `file` is a
// key of FILES, `re` is a regular expression source with these placeholders:
//   ⟨ID⟩     capture an obfuscated name
//   ⟨_⟩      any obfuscated name (not captured)
//   ⟨key⟩    a name found by an earlier rule
// String constants are matched as literals: the game keeps them in _strings.js as
// variables, which are replaced by their values before matching.
// `what` is the description written to names.js.
const RULES = [
  // ----- Characters -----
  { file: 'frame2', keys: ['chars', 'me'],
    what: ['characters array', 'index of your character in chars'],
    re: String.raw`=="god"\)\s*\{\s*⟨ID⟩\[⟨ID⟩\]\.hmax\*=100000;` },
  { file: 'frame2', keys: ['dead', 'dying', 'updateBody'],
    what: ['character property: dead', 'character property: knocked down (can be revived)',
      'function(i): breaks or restores body parts from their HP'],
    re: String.raw`=="god"\)\s*\{\s*⟨chars⟩\[⟨me⟩\]\.hmax\*=100000;\s*⟨chars⟩\[⟨me⟩\]\["hea"\]=⟨chars⟩\[⟨me⟩\]\.hmax;\s*if\(⟨chars⟩\[⟨me⟩\]\.⟨ID⟩\)\s*⟨chars⟩\[⟨me⟩\]\.⟨_⟩=false;\s*if\(⟨chars⟩\[⟨me⟩\]\.⟨ID⟩\)\s*⟨chars⟩\[⟨me⟩\]\.⟨_⟩=false;\s*⟨ID⟩\(⟨me⟩\);` },
  { file: 'frame2', keys: ['charCount'], what: ['number of character slots in use'],
    re: String.raw`=="kill enemies"\)\s*\{\s*for\(i=0;i<⟨ID⟩;i\+\+\)` },
  { file: 'frame2', keys: ['refreshChar'], what: ['function(i): re-evaluates held weapon/swords of character i'],
    re: String.raw`function ⟨ID⟩\(a\)\s*\{\s*if\(a>=0\)\s*\{\s*if\(⟨chars⟩\[a\]\["hea"\]>0\)\s*\{\s*⟨chars⟩\[a\]\.⟨_⟩=1;\s*if\(a==⟨me⟩\)` },
  { file: 'frame2', keys: ['healChar'], what: ['function(target, healer, power, force): heal/revive (defibrillator)'],
    re: String.raw`function ⟨ID⟩\(⟨_⟩,mc,⟨_⟩=1,⟨_⟩=false,⟨_⟩=⟨_⟩\)` },
  { file: 'frame2',
    keys: ['headHp', 'faceHp', 'legsHp', 'armsHp', 'headOff', 'faceGone', 'legsBroken', 'armsBroken'],
    what: ['body part HP: head (0 = head blown off)', 'body part HP: face (0 = head destroyed)',
      'body part HP: lower body', 'body part HP: arms', 'flag: head blown off', 'flag: head destroyed',
      'flag: lower body broken', 'flag: arms broken'],
    re: String.raw`\.⟨ID⟩=\(Math\.max\(⟨_⟩\["hea"\]\*0\.4,30\)\);\s*⟨_⟩\.⟨ID⟩=\(Math\.max\(⟨_⟩\["hea"\]\*0\.6,30\)\);\s*⟨_⟩\.⟨ID⟩=\(Math\.max\(⟨_⟩\["hea"\]\*0\.5,30\)\);\s*⟨_⟩\.⟨ID⟩=\(Math\.max\(⟨_⟩\["hea"\]\*0\.4,30\)\);\s*⟨_⟩\.⟨ID⟩=false;\s*⟨_⟩\.⟨ID⟩=false;\s*⟨_⟩\.⟨ID⟩=false;\s*⟨_⟩\.⟨ID⟩=false;` },
  { file: 'frame2', keys: ['jump'], what: ['character property: jump multiplier'],
    re: String.raw`mc\["tox"\]=7\*mc\.⟨ID⟩\+x4;` },
  { file: 'frame2', keys: ['walk'], what: ['character property: walk direction this tick'],
    re: String.raw`mc\.⟨ID⟩=1\*Math\.min\(\(mc\.⟨_⟩\+1\)\/2,2\)\*mc\.scale;` },
  { file: 'frame2', keys: ['playerDt'], what: ['player time factor for the next tick'],
    // Three smoothing lines in a row; the player one is right before the fixed 30 fps one.
    re: String.raw`⟨ID⟩=\(⟨_⟩\/\(1000\/⟨_⟩\)\+⟨_⟩\*3\)\/4;\s*⟨_⟩=\(⟨_⟩\/\(1000\/30\)\+` },
  { file: 'actions', keys: ['noSwords'], what: ['character property: swords disabled'],
    re: String.raw`⟨chars⟩\[⟨_⟩\]\.⟨ID⟩=\(⟨_⟩==="true"\);\s*if\(⟨chars⟩\[⟨_⟩\]\.io\)\s*if\(!⟨chars⟩\[⟨_⟩\]\.⟨dead⟩\)\s*⟨refreshChar⟩\(⟨_⟩\);` },

  // ----- Physics points and teleport (map trigger "move character to region") -----
  { file: 'actions',
    keys: ['_', 'ptCount', 'ptOwner', 'charIndex', 'gunPtBase', 'gunPtRange', 'guns', 'ptX', 'ptY',
      'interpolating', 'ptPrevX', 'ptPrevY', 'clearPtInterp'],
    what: [null, 'number of physics points', 'owner of each point (character index, or gunPtBase + gun index)',
      'character/gun property: own index', 'owner offset for gun points', 'owner range for gun points',
      'guns array', 'point x array', 'point y array', 'function(): interpolation enabled',
      'previous point x array', 'previous point y array', 'function(i): clear interpolation of point i'],
    re: String.raw`for\(⟨ID⟩=0;⟨_⟩<⟨ID⟩;⟨_⟩\+\+\)\s*if\(⟨ID⟩\[⟨_⟩\]===⟨_⟩\.⟨ID⟩\|\|\s*\(⟨_⟩\[⟨_⟩\]>=⟨ID⟩&&⟨_⟩\[⟨_⟩\]<⟨_⟩\+⟨ID⟩&&⟨ID⟩\[⟨_⟩\[⟨_⟩\]-⟨_⟩\]\.picken_by===⟨_⟩\.⟨_⟩\)\)\s*\{\s*⟨ID⟩\[⟨_⟩\]-=u;\s*⟨ID⟩\[⟨_⟩\]-=v;\s*if\(⟨ID⟩\(\)\)\s*\{\s*⟨ID⟩\[⟨_⟩\]-=u;\s*⟨ID⟩\[⟨_⟩\]-=v;\s*\}\s*⟨ID⟩\(⟨_⟩\);` },
  { file: 'actions', keys: ['cameraTarget', 'spectating'],
    what: ['camera target (-1 = none)', 'spectator mode'],
    re: String.raw`if\(⟨_⟩==⟨me⟩\)\s*if\(⟨ID⟩!==-1\|\|!⟨ID⟩\)\s*\{\s*game\["x"\]\+=u;` },
  { file: 'actions', keys: ['refPoint'], what: ['character property: index of its reference physics point'],
    re: String.raw`u=⟨ptX⟩\[⟨_⟩\.⟨ID⟩\]-\(` },
  { file: 'actions', keys: ['effect', 'effectTypes', 'effectTeleport', 'afterMove'],
    what: ['function(x, y, type, a, b): spawn an effect', 'effect type table',
      'effect type: teleport flash', 'character method called after it was moved'],
    re: String.raw`⟨ID⟩\(⟨_⟩\["x"\],⟨_⟩\["y"\]-41,⟨ID⟩\.⟨ID⟩,0,0\);\s*⟨_⟩\["x"\]-=u;\s*⟨_⟩\["y"\]-=v;\s*⟨_⟩\(⟨_⟩\["x"\],⟨_⟩\["y"\]-41,⟨_⟩\.⟨_⟩,0,0\);\s*⟨_⟩\.⟨ID⟩\(\);` },

  // ----- Guns -----
  { file: 'frame2', keys: ['gunFactory'], what: ['function(model, {x, y, upg, command}): spawn a gun'],
    re: String.raw`function ⟨ID⟩\(⟨_⟩,params,⟨_⟩=false\)` },
  { file: 'frame2', keys: ['strDecode'], what: ['function(str, hash, len): string wrapper used by the gun factory'],
    re: String.raw`function ⟨ID⟩\(str,hash,len\)` },
  { file: 'frame2', keys: ['gunName'], what: ['function(model): gun display name'],
    re: String.raw`function ⟨ID⟩\(⟨_⟩\)\s*\{\s*var ⟨_⟩="";\s*switch\(⟨_⟩\)\s*\{\s*case "gun_rifle":` },
  { file: 'guns', keys: ['gunSlot'], what: ['gun property: slot 0-9 (-2 = grenade item)'],
    re: String.raw`function ⟨_⟩\(\):void\s*\{\s*this\.⟨ID⟩=-?\d+;\s*this\.⟨_⟩=-?\d+;\s*this\.ready=true;` },
  { file: 'frame2', keys: ['gunFixed'], what: ['gun property: cannot be carried (vehicle gun)'],
    re: String.raw`if\(mc\.picken_by==-1\)\s*\{\s*if\(mc\.⟨ID⟩==false\)` },
  { file: 'frame2', keys: ['gunPellets'], what: ['gun property: projectiles per shot'],
    re: String.raw`\+=⟨_⟩\["stat_power"\]\*⟨_⟩\.⟨ID⟩\/\(⟨_⟩\.totalFrames\)\*100;` },
  { file: 'frame2', keys: ['gunSpread', 'gunBloom'], what: ['gun property: spread', 'gun property: current extra inaccuracy'],
    re: String.raw`-=\(⟨_⟩\.⟨ID⟩\+⟨_⟩\.⟨ID⟩\)\*\(⟨_⟩\.totalFrames\/⟨_⟩\.⟨gunPellets⟩\)` },
  { file: 'frame2', keys: ['gunRate'], what: ['gun property: fire-rate multiplier'],
    re: String.raw`return\(⟨_⟩\/mc\.⟨ID⟩\/Math\.max\(mc\.⟨gunPellets⟩,1\)<5\);` },
  { file: 'frame2', keys: ['gunRecoil'], what: ['gun property: recoil multiplier'],
    re: String.raw`if\(params\.⟨gunRate⟩===undefined\)\s*⟨_⟩\.⟨gunRate⟩=1;\s*else\s*⟨_⟩\.⟨gunRate⟩=params\.⟨gunRate⟩;\s*if\(params\.⟨ID⟩===undefined\)` },
  // End of the game's own weapon drop (V key): wake both gun points so the gun falls.
  { file: 'frame2', keys: ['wakePt', 'gunPtA', 'gunPtB'],
    what: ['function(pt): wakes a sleeping physics point', 'gun property: first physics point', 'gun property: second physics point'],
    re: String.raw`⟨ID⟩\(⟨_⟩\.⟨ID⟩\);\s*⟨_⟩\(⟨_⟩\.⟨ID⟩\);\s*mc\["curwea"\]=-1;\s*⟨refreshChar⟩\(i\);` },
  // Start of the same drop: the toss (velocity along the aim angle, offset in the facing direction).
  { file: 'frame2', keys: ['ptVelX', 'aimAngle', 'ptVelY'],
    what: ['physics point x velocities', 'character property: aim angle (radians)', 'physics point y velocities'],
    re: String.raw`⟨ID⟩\[⟨_⟩\.⟨gunPtA⟩\]\+=Math\.sin\(mc\.⟨ID⟩\)\*7;\s*⟨ID⟩\[⟨_⟩\.⟨gunPtA⟩\]\+=Math\.cos\(mc\.⟨_⟩\)\*7-2;` },
  { file: 'frame2', keys: ['facing'], what: ['character property: facing direction (-1 or 1)'],
    re: String.raw`⟨ptX⟩\[⟨_⟩\.⟨gunPtA⟩\]\+=mc\.⟨ID⟩\*20;` },

  // ----- Bullets -----
  { file: 'frame2', keys: ['bullets', 'bulletDamage'], what: ['bullets array (ring buffer)', 'bullet property: damage'],
    re: String.raw`if\(⟨_⟩\["hea"\]>0\)\s*⟨ID⟩\[i\]\.⟨ID⟩=Math\.max\(0,⟨_⟩\[i\]\.⟨_⟩\*0\.3\);` },
  { file: 'frame2', keys: ['bulletLife', 'bulletOwner'], what: ['bullet property: max age', 'bullet property: owner character index'],
    re: String.raw`if\(⟨bullets⟩\[i\]\.⟨_⟩>⟨bullets⟩\[i\]\.⟨ID⟩\)\s*\{\s*if\(⟨bullets⟩\[i\]\.⟨_⟩===undefined\|\|⟨bullets⟩\[i\]\.⟨ID⟩===⟨me⟩\)` },

  // ----- Map triggers, regions, timers (map loader) -----
  { file: 'frame2',
    keys: ['triggers', 'triggerCount', 'trigEnabled', 'trigAtStart', 'trigMaxCalls', 'trigCalls', 'trigActionCount'],
    what: ['map triggers array', 'number of map triggers', 'trigger/timer property: enabled',
      'trigger property: runs when the map starts', 'trigger property: max calls (-1 = unlimited)',
      'trigger/timer property: calls left (-1 = unlimited)', 'trigger property: number of actions'],
    re: String.raw`if\(a=="trigger"\)\s*\{\s*⟨ID⟩\[⟨ID⟩\]=new Object\(\);\s*⟨_⟩\[⟨_⟩\]\.⟨ID⟩=false;\s*⟨_⟩\[⟨_⟩\]\.⟨ID⟩=\(b\["#execute"\]=="true"\);\s*⟨_⟩\[⟨_⟩\]\.⟨_⟩=\(b\["#enabled"\]=="true"\);\s*⟨_⟩\[⟨_⟩\]\.⟨_⟩=⟨_⟩\[⟨_⟩\]\.⟨_⟩;\s*⟨_⟩\[⟨_⟩\]\.⟨ID⟩=⟨_⟩\[⟨_⟩\]\.⟨ID⟩=parseInt\(b\["#maxcalls"\]\);\s*⟨_⟩\[⟨_⟩\]\.⟨ID⟩=0;` },
  { file: 'frame2', keys: ['trigTargetA', 'trigTargetB', 'trigTypes'],
    what: ['trigger property: action target A (array)', 'trigger property: action target B (array)', 'trigger property: action types (array)'],
    re: String.raw`function ⟨_⟩\(a,⟨_⟩,⟨_⟩,type\)\s*\{\s*⟨triggers⟩\[a\]\.⟨ID⟩\[⟨triggers⟩\[a\]\.⟨trigActionCount⟩\]=⟨_⟩;\s*⟨triggers⟩\[a\]\.⟨ID⟩\[⟨triggers⟩\[a\]\.⟨trigActionCount⟩\]=⟨_⟩;\s*⟨triggers⟩\[a\]\.⟨ID⟩\[⟨triggers⟩\[a\]\.⟨trigActionCount⟩\]=parseInt\(type\);` },
  { file: 'frame2', keys: ['regions', 'regionCount'], what: ['map regions array', 'number of map regions'],
    re: String.raw`if\(a=="region"\)\s*\{\s*⟨ID⟩\[⟨ID⟩\]=new Object\(\);` },
  { file: 'frame2', keys: ['regionTrigger', 'regionUseOn'],
    what: ['region property: trigger it activates (-1 = none)', 'region property: activation mode (1 = use key)'],
    re: String.raw`if\(b\["#use_target"\]\.charAt\(0\)=="#"\)\s*⟨regions⟩\[⟨regionCount⟩\]\.⟨ID⟩=b\["#use_target"\];\s*else\s*⟨_⟩\[⟨_⟩\]\.⟨_⟩=parseInt\(b\["#use_target"\]\);\s*⟨_⟩\[⟨_⟩\]\.⟨ID⟩=parseInt\(b\["#use_on"\]\);` },
  { file: 'frame2', keys: ['regionUsesTimer'], what: ['region property: enables the timer its target names instead of running a trigger'],
    re: String.raw`⟨regions⟩\[⟨regionCount⟩\]\.⟨ID⟩=\(b\["#uses_timer"\]==="true"\|\|b\["#uses_timer"\]==="1"\);` },
  // The region check: which characters each activation mode accepts.
  { file: 'frame2', keys: ['charVehicle'], what: ['character property: vehicle it is in (-1 = none)'],
    re: String.raw`\(⟨regions⟩\[i2\]\.⟨regionUseOn⟩==2&&mc\.⟨ID⟩==-1\)\|\|` },
  { file: 'frame2', keys: ['charHuman'], what: ['character property: a player, not a bot'],
    re: String.raw`\(⟨regions⟩\[i2\]\.⟨regionUseOn⟩==17&&\(!mc\.⟨ID⟩&&mc\["hea"\]>0\)\)` },
  { file: 'frame2', keys: ['timers', 'timerCount'], what: ['map timers array', 'number of map timers'],
    re: String.raw`if\(a=="timer"\)\s*\{\s*⟨ID⟩\[⟨ID⟩\]=new Object\(\);` },
  // A shot that hits a movable with a trigger: sets the activator and power, then runs it.
  { file: 'frame2', keys: ['triggerActivator', 'triggerPower', 'runTrigger'],
    what: ['character index that activated the running trigger', 'power passed to the running trigger (shot damage)',
      'function(trigger index): runs a trigger if enabled with calls left (always returns true in a level)'],
    re: String.raw`⟨ID⟩=⟨me⟩;\s*⟨ID⟩=⟨bullets⟩\[i\]\.⟨bulletDamage⟩;\s*if\(⟨ID⟩\(` },
  // The map loader's target fixup, run on every trigger action's A and B once the map
  // is in: "#uid" becomes that object's index, a whole number becomes a number.
  { file: 'frame2', keys: ['resolveTarget'],
    what: ['function(text): an action target as the map loader stores it ("#uid" -> index, "12" -> 12)'],
    re: String.raw`function ⟨ID⟩\(⟨_⟩\)\s*\{\s*if\(⟨_⟩===null\|\|⟨_⟩===undefined\)\s*⟨_⟩="-1";\s*⟨_⟩\+="";\s*if\(⟨_⟩\.charAt\(0\)==="#"\)` },
  // Each <decor> of the map, as the loader makes it: a display object, stored in map order.
  { file: 'frame2', keys: ['decors'], what: ['map decorations array (display objects, in map order)'],
    re: String.raw`⟨ID⟩\[⟨_⟩\]=mc;\s*if\(mc\.⟨_⟩\)\s*mc\.⟨_⟩\(\);\s*⟨_⟩\(b\["#uid"\],⟨_⟩\);` },
  // Walls: the loader keeps each <box> in parallel arrays, counted in map order.
  { file: 'frame2', keys: ['wallX', 'wallCount', 'wallY', 'wallW', 'wallH', 'wallMaterial'],
    what: ['wall x array', 'number of walls', 'wall y array', 'wall width array', 'wall height array', 'wall material array'],
    re: String.raw`if\(a=="box"\)\s*\{\s*⟨ID⟩\[⟨ID⟩\]=parseFloat\(b\["#x"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#y"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#w"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#h"\]\);\s*⟨ID⟩\[` },
  // The wall collision grid: cells of gridCell units from (gridMinX, gridMinY), each a
  // list of wall indexes; gridAddWall(i) puts wall i into every cell it reaches.
  { file: 'frame2', keys: ['gridCell', 'grid', 'gridCols', 'gridRows', 'gridMinX', 'gridMinY', 'gridAddWall'],
    what: ['wall grid cell size (100)', 'wall grid: [column][row] -> wall indexes', 'wall grid columns', 'wall grid rows',
      'wall grid left edge', 'wall grid top edge', 'function(wall index): adds a wall to the grid cells it reaches'],
    re: String.raw`var ⟨ID⟩=100;\s*var ⟨ID⟩;\s*var ⟨_⟩=\[\];\s*var ⟨ID⟩;\s*var ⟨ID⟩;\s*var ⟨ID⟩;\s*var ⟨_⟩;\s*var ⟨ID⟩;\s*var ⟨_⟩;\s*function ⟨ID⟩\(` },
  // Each <door> (movable) of the map: a display object in the 3D layer, in map order.
  { file: 'frame2', keys: ['doors', 'doorCount'], what: ['map movables array (display objects, in map order)', 'number of movables'],
    re: String.raw`⟨ID⟩\[⟨ID⟩\]=mc;\s*mc\.w=parseFloat\(b\["#w"\]\);\s*mc\.h=parseFloat\(b\["#h"\]\);` },
  // Backgrounds: drawn once into a shared layer; their rectangles also kept in arrays.
  { file: 'frame2', keys: ['bgX', 'bgCount', 'bgY', 'bgW', 'bgH', 'bgShadow'],
    what: ['background x array', 'number of backgrounds', 'background y array', 'background width array',
      'background height array', 'background "spawn shadow" array'],
    re: String.raw`⟨ID⟩\[⟨ID⟩\]=x;\s*⟨ID⟩\[⟨_⟩\]=y;\s*⟨ID⟩\[⟨_⟩\]=w;\s*⟨ID⟩\[⟨_⟩\]=h;\s*⟨ID⟩\[⟨_⟩\]=\(b\["#s"\]!=="false"\);` },
  // Pushers (gravitator fields): corners and settings in parallel arrays.
  { file: 'frame2', keys: ['pushX1', 'pushCount', 'pushY1', 'pushX2', 'pushY2', 'pushToX', 'pushToY', 'pushStab', 'pushDamage'],
    what: ['pusher left array', 'number of pushers', 'pusher top array', 'pusher right array (x + w)', 'pusher bottom array (y + h)',
      'pusher acceleration x array', 'pusher acceleration y array', 'pusher stability damage array', 'pusher damage array'],
    re: String.raw`⟨ID⟩\[⟨ID⟩\]=parseFloat\(b\["#x"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#y"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#w"\]\)\+⟨_⟩\[⟨_⟩\];\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#h"\]\)\+⟨_⟩\[⟨_⟩\];\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#tox"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#toy"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#stab"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#damage"\]\);` },
  // Water: a display object each, and the area it acts on in parallel arrays.
  { file: 'frame2', keys: ['waters', 'waterCount'], what: ['water display objects array', 'number of waters'],
    re: String.raw`⟨ID⟩\[⟨ID⟩\]=new water\(\);` },
  { file: 'frame2', keys: ['waterX', 'waterY', 'waterW', 'waterH', 'waterDamage'],
    what: ['water area x array (map x - 10 after load)', 'water area y array', 'water area width array (map w + 20)',
      'water area height array (map h + 10)', 'water damage array'],
    re: String.raw`⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#x"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#y"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#w"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#h"\]\);\s*⟨ID⟩\[⟨_⟩\]=parseFloat\(b\["#damage"\]\);` },
  // A visible movable's texture, made after the map is read: a texture_front0 in the 3D
  // layer, made inert to the mouse, then tied to the movable's index so it follows it.
  { file: 'frame2', keys: ['displayInit', 'textureFollows'],
    what: ['function(display object): makes it ignore the mouse (every object the loader puts on screen)',
      'function(texture, movable index): the texture follows that movable'],
    re: String.raw`⟨_⟩=graphics_3d\.addChildAt\(new texture_front0,graphics_3d\.numChildren\);\s*⟨ID⟩\(⟨_⟩\);\s*⟨_⟩\["x"\]=⟨doors⟩\[i\]\["x"\];[^;]*;[^;]*;[^;]*;\s*⟨ID⟩\(⟨_⟩,i\);` },
  // The same shot, in multiplayer: tells the server so every other client runs it too.
  { file: 'frame2', keys: ['net', 'netNum'],
    what: ['multiplayer network class (.Event(type, ...parts) sends to the server)',
      'net function(n): encodes a number for a network message'],
    re: String.raw`⟨ID⟩\.Event\(\s*⟨_⟩\["RELIABLE_EXEC_TRIGGER"\],\s*⟨_⟩\.⟨ID⟩\(` },
  // Joining a match from the lobby: [type, match uid, callback, slot, "1" = send me the map, password].
  { file: 'flash', keys: ['lobbyConn', 'netSend'],
    what: ['net property: lobby/match server connection', 'connection method(channel, parts, callback): send a message'],
    re: String.raw`⟨net⟩\.⟨ID⟩\.⟨ID⟩\(⟨net⟩\.⟨_⟩,\[⟨net⟩\["RELIABLE_JOIN_MATCH"\],-1,` },
  // Kept for the game's multiplayer logs screen. A sent message is always added
  // (scripts/connection.js); a received one only with TRACK_MP_LOGS.
  { file: 'flash', keys: ['netLog'],
    what: ['net property: recent network messages, oldest first: { type, parts, time }'],
    re: String.raw`if\(TRACK_MP_LOGS\)\s*\{\s*⟨net⟩\.⟨ID⟩\.push\(⟨_⟩\);` },
  // The anti-cheat's locked arrays (ANTICHEAT.md §7). The scan's code 3 report sends an
  // index into this list.
  { file: 'tools', keys: ['lockedArrays'],
    what: ['anti-cheat locked arrays, in the order the scan compares them'],
    re: String.raw`let ⟨ID⟩=\[\];\s*let ⟨_⟩=new Map\(\);\s*let ⟨_⟩=true;` },
  { file: 'flash', keys: ['mapText', 'mapChunks'],
    what: ['globalThis property: map XML of the level being loaded (compressed "<q." until the level starts)',
      'net property: multiplayer map chunks received so far (null = none)'],
    re: String.raw`root\.⟨ID⟩=⟨net⟩\.⟨ID⟩\.join\(""\);` },
  // The function that builds a level (frame18.js calls it once per level start). Its
  // first lines: unlock the locked arrays, set a quicksave flag, clear a list. Its body
  // (past a nested empty debug function) unpacks a "<q." map. Used by hooks (Game.levelStart).
  { file: 'frame2', keys: ['levelStart'],
    what: ['function(): builds the level from the map text (once per level start)'],
    re: String.raw`function ⟨ID⟩\(\)\s*\{\s*⟨_⟩\(\);\s*⟨_⟩\.⟨_⟩=true;\s*⟨_⟩\.length=0;\s*⟨_⟩=\[-1,-1\];[\s\S]{0,6000}?root\.⟨mapText⟩\.slice\(0,3\)=="<q\."` },
  { file: 'frame2', keys: ['charOnDeath'], what: ['character property: trigger run when it dies (-1 = none)'],
    re: String.raw`if\(b\["#ondeath"\]\.charAt\(0\)=="#"\)\s*mc\.⟨ID⟩=b\["#ondeath"\];` },
  // The camera zoom the game sets (1 = 100%): the map's "gamescale" engine mark, the
  // "set zoom" trigger actions and the chat's "zoom 50" write it, the camera follows it.
  { file: 'frame2', keys: ['zoom'], what: ['camera zoom (1 = 100%)'],
    re: String.raw`if\(b\["#mark"\]==="gamescale"\)\s*\{\s*⟨ID⟩=parseFloat\(b\["#forteam"\]\)\/100;` },
  { file: 'frame2', keys: ['timerTarget'], what: ['timer property: trigger it calls'],
    re: String.raw`if\(b\["#target"\]\.charAt\(0\)==="#"\)\s*⟨timers⟩\[⟨timerCount⟩\]\.⟨ID⟩=b\["#target"\];` },
  // The map's "var_sync" engine mark: set from an <inf mark="var_sync"> element, and the
  // gate on both sending and applying a variable sync. Never set back to false.
  { file: 'frame2', keys: ['varSyncOn'], what: ['map engine mark: variable syncing allowed'],
    re: String.raw`if\(b\["#mark"\]==="var_sync"\)\s*\{\s*⟨ID⟩=true;` },
  // Map variables: one object, variable name -> value, emptied when a map loads. Found at
  // the "sync this variable to the server" action, which reads both the name and the value.
  { file: 'actions', keys: ['mapVars'], what: ['map variables object (variable name -> value)'],
    re: String.raw`throw new Error\("Buffer overflow during var sync: Variable name is too long"\);\s*if\(\(⟨ID⟩\[⟨triggers⟩\[a\]\.⟨trigTargetA⟩\[⟨_⟩\]\]\+""\)\.length>2048\)` },

  // ----- Input, chat, multiplayer, map -----
  // The map being loaded or played: a campaign level ("c31a") or a custom map ID, set as
  // the load starts, before the built-in levels table is looked up.
  { file: 'frame2', keys: ['mapId'], what: ['ID of the map loaded last (campaign "c31a" or a custom map ID)'],
    re: String.raw`⟨_⟩=str;\s*⟨ID⟩=str;\s*⟨_⟩\.visible=true;\s*⟨_⟩\.⟨_⟩\.gotoAndPlay\(1\);\s*if\(⟨_⟩\[⟨_⟩\]!=undefined\)` },
  { file: 'frame2', keys: ['keyUp'], what: ['jump key held'],
    re: String.raw`if\(event\.keyCode===87\|\|event\.keyCode===38\|\|event\.keyCode===32\)\s*\{\s*⟨ID⟩=true;` },
  { file: 'frame2', keys: ['keyDown'], what: ['crouch key held'],
    re: String.raw`if\(event\.keyCode===83\|\|event\.keyCode===40\)\s*⟨ID⟩=true;` },
  { file: 'frame2', keys: ['mp'], what: ['true in a multiplayer match'],
    re: String.raw`if\(!⟨ID⟩\|\|⟨_⟩==="bot 1"\|\|⟨_⟩==="bot 0"\)` },
  { file: 'frame2', keys: ['chatTyping'], what: ['in-game chat input is open'],
    re: String.raw`if\(⟨ID⟩&&event\.keyCode===13\)\s*\{\s*⟨_⟩=false;` },
  { file: 'frame2', keys: ['customMap'], what: ['custom map session: chat goes to map triggers'],
    re: String.raw`if\(⟨ID⟩\)\s*\{\s*ChatNewMsg\("<font color=\\"#78DBE2\\">"` },
  { file: 'frame2', keys: ['openChat'], what: ['function(text): open the chat prefilled with text'],
    re: String.raw`function ⟨ID⟩\(⟨_⟩="",⟨_⟩=false\)\s*\{\s*⟨chatTyping⟩=true;` },
  { file: 'frame2', keys: ['sayTrigger'], what: ['map "player says" trigger index'],
    re: String.raw`function ⟨_⟩\(⟨_⟩,str\)\s*\{\s*if\(⟨ID⟩>=0\)` },
  { file: 'frame2', keys: ['chatPopups'], what: ['floating chat messages (let variable)'],
    re: String.raw`function ChatNewMsg\(⟨_⟩\)\s*\{[\s\S]{0,600}?for\(let i=0;i<⟨ID⟩\.length;i\+\+\)` },
  { file: 'frame2', keys: ['chatPanel'], what: ['chat log panel (globalThis property)'],
    re: String.raw`function ChatNewMsg\(⟨_⟩\)\s*\{[\s\S]{0,300}?if\(!globalThis\.⟨ID⟩\|\|globalThis\.⟨_⟩\.isRemoved\)` },
  { file: 'frame2', keys: ['chatPanelText'], what: ['chat panel item property: text field'],
    re: String.raw`\["item"\+⟨_⟩\]\.⟨ID⟩\.htmlText=⟨_⟩;` },
  { file: 'ui', keys: ['uiOverlay'], what: ['UI class holding .overlay'],
    re: String.raw`⟨ID⟩\.overlay=⟨_⟩\.⟨_⟩\(\);` },

  // ----- Level end -----
  { file: 'frame2', keys: ['levelState', 'failText'],
    what: ['level end state ("" while playing, "failed" after death)', 'level end message'],
    re: String.raw`⟨ID⟩="failed";\s*if\(⟨_⟩\[⟨me⟩\]\.⟨_⟩==⟨me⟩\|\|⟨_⟩\[⟨me⟩\]\.⟨_⟩==-1\)\s*\{\s*⟨ID⟩="BAD LUCK, YOU DIED\."` },
  { file: 'frame2', keys: ['fadeOverlay'], what: ['black fade overlay (globalThis property)'],
    re: String.raw`⟨ID⟩\.visible=true;\s*if\(!⟨_⟩\)\s*\{\s*⟨_⟩=Math\.random\(\)\*Math\.PI\*2;` },
];

// Cross-checks run after all rules: each must match at least once.
const CHECKS = [
  { file: 'frame2', what: 'updateBody pairs each part HP with its flag',
    re: String.raw`function ⟨updateBody⟩\(n\)[\s\S]*?⟨chars⟩\[n\]\.⟨legsHp⟩<=0\)\s*\{\s*if\(!⟨chars⟩\[n\]\.⟨legsBroken⟩\)[\s\S]*?⟨chars⟩\[n\]\.⟨armsHp⟩<=0\)\s*\{\s*if\(!⟨chars⟩\[n\]\.⟨armsBroken⟩\)[\s\S]*?⟨chars⟩\[n\]\.⟨faceHp⟩<=0\)\s*\{\s*if\(!⟨chars⟩\[n\]\.⟨faceGone⟩\)[\s\S]*?⟨chars⟩\[n\]\.⟨headHp⟩<=0\)\s*\{\s*if\(!⟨chars⟩\[n\]\.⟨headOff⟩\)` },
  { file: 'frame2', what: 'healChar skips characters with a destroyed head',
    re: String.raw`if\(⟨chars⟩\[⟨_⟩\]\.⟨headOff⟩\)\s*\{\s*\}\s*else\s*if\(⟨chars⟩\[⟨_⟩\]\.⟨faceGone⟩\)` },
  { file: 'frame2', what: 'gun factory sets the gun index',
    re: String.raw`⟨_⟩\.⟨charIndex⟩=⟨_⟩;\s*⟨_⟩\.⟨_⟩=⟨_⟩\(⟨_⟩\["x"\]\+` },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ascii = (s) => s.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function loadStrings(gameDir) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(gameDir, '_strings.js'), 'utf8'), ctx);
  const map = new Map();
  for (const [k, v] of Object.entries(ctx)) if (typeof v === 'string' && k.startsWith('$')) map.set(k, v);
  return map;
}

// Replaces string-constant variables with their JSON literal (not after "." = property).
function decode(src, strings) {
  return src.replace(new RegExp(`(^|[^.${ID_CHARS}$])(\\$[${ID_CHARS}]+)`, 'g'),
    (m, pre, name) => (strings.has(name) ? pre + JSON.stringify(strings.get(name)) : m));
}

function compile(source, found) {
  const captures = [];
  const re = source.replace(/⟨([A-Za-z_]+)⟩/g, (m, k) => {
    if (k === 'ID') { captures.push(true); return `(\\$[${ID_CHARS}]+)`; }
    if (k === '_') return `\\$[${ID_CHARS}]+`;
    if (!found[k]) throw new Error(`needs "${k}" first`);
    return escapeRe(found[k]);
  });
  return new RegExp(re, 'g');
}

function findNames(gameDir) {
  const strings = loadStrings(gameDir);
  const code = {};
  for (const [k, rel] of Object.entries(FILES)) {
    code[k] = decode(fs.readFileSync(path.join(gameDir, rel), 'utf8'), strings);
  }
  const found = {};
  const info = {};
  const problems = [];
  let pending = RULES.slice();
  // Rules may depend on names from other rules; repeat until nothing changes.
  for (let pass = 0; pending.length && pass < 10; pass++) {
    const next = [];
    for (const rule of pending) {
      let re;
      try { re = compile(rule.re, found); } catch { next.push(rule); continue; }
      const values = rule.keys.map(() => new Set());
      let count = 0;
      for (const m of code[rule.file].matchAll(re)) {
        count++;
        rule.keys.forEach((k, i) => values[i].add(m[i + 1]));
      }
      if (!count) { problems.push(`${rule.keys.filter((k) => k !== '_').join(', ')}: pattern not found in ${FILES[rule.file]}`); continue; }
      rule.keys.forEach((k, i) => {
        if (k === '_') return;
        if (values[i].size > 1) { problems.push(`${k}: ambiguous in ${FILES[rule.file]} (${[...values[i]].join(', ')})`); return; }
        found[k] = [...values[i]][0];
        info[k] = { what: rule.what[i], file: FILES[rule.file], matches: count };
      });
    }
    if (next.length === pending.length) {
      for (const rule of next) problems.push(`${rule.keys.join(', ')}: depends on a name that was not found`);
      break;
    }
    pending = next;
  }
  for (const c of CHECKS) {
    try {
      if (!compile(c.re, found).test(code[c.file])) problems.push(`check failed: ${c.what}`);
    } catch (e) {
      problems.push(`check skipped (${e.message}): ${c.what}`);
    }
  }
  const expected = RULES.flatMap((r) => r.keys).filter((k) => k !== '_');
  const missing = expected.filter((k) => !found[k]);
  return { found, info, problems, missing, expected };
}

function gameVersion(gameDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(gameDir, 'pb2-version.json'), 'utf8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function render(result, version) {
  const lines = [
    '// Generated by tools/find-names.js. Do not edit by hand: run "npm run find-names".',
    `// Game version: ${version}`,
    '// Obfuscated game names used by the dev console. They can change with every game',
    '// version; see README.md, "Finding the obfuscated names".',
    'globalThis.PB2_NAMES = {',
    `  version: ${JSON.stringify(version)},`,
  ];
  for (const k of result.expected) {
    if (!result.found[k]) { lines.push(`  ${k}: null, // NOT FOUND`); continue; }
    const name = result.found[k];
    lines.push(`  ${k}: '${ascii(name)}', // ${name}  ${result.info[k].what} (${result.info[k].file})`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

function run(opts = {}) {
  const gameDir = path.resolve(opts.gameDir || path.join(REPO, 'game'));
  const out = path.resolve(opts.out || path.join(REPO, 'desktop', 'dev', 'names.js'));
  if (!fs.existsSync(path.join(gameDir, '_strings.js'))) {
    throw new Error(`No game files in ${gameDir}. Run "npm run fetch-game" first.`);
  }
  const result = findNames(gameDir);
  const version = gameVersion(gameDir);
  const total = result.expected.length;
  console.log(`Found ${total - result.missing.length} of ${total} names in ${gameDir} (version ${version}).`);
  for (const p of result.problems) console.log(`  problem: ${p}`);
  if (!opts.check) {
    fs.writeFileSync(out, render(result, version));
    console.log(`Wrote ${path.relative(process.cwd(), out) || out}`);
  }
  return result;
}

module.exports = { run, findNames, RULES };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') opts.out = args[++i];
    else if (args[i] === '--check') opts.check = true;
    else if (args[i] === '--decode') opts.decode = args[++i];
    else if (args[i] === '-h' || args[i] === '--help') {
      console.log('Usage: node tools/find-names.js [gameDir] [--out file] [--check] [--decode file]');
      process.exit(0);
    } else opts.gameDir = args[i];
  }
  // process.exitCode (not process.exit) so piped output is fully written first.
  try {
    if (opts.decode) {
      const gameDir = path.resolve(opts.gameDir || path.join(REPO, 'game'));
      const src = fs.readFileSync(path.join(gameDir, opts.decode), 'utf8');
      process.stdout.write(decode(src, loadStrings(gameDir)));
    } else {
      const r = run(opts);
      process.exitCode = r.missing.length || r.problems.length ? 1 : 0;
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
