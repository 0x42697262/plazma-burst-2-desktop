export const TEXT = Object.freeze({
  logicTitle: 'logic: shown',
  logicRow: (description: string) => `  ${description || 'on'}`,
  varsTitle: (count: number) => `vars you changed: ${count}`,
  varsRow: (name: string, now: string, was: string) => `  ${name} ${now}  (was ${was})`,
});

export const REGION_MODES: Readonly<Record<number, string>> = Object.freeze({
  0: 'never (only a target for other actions)',
  1: 'use key', 2: 'character enters', 3: 'vehicle enters',
  4: 'anything enters', 5: 'door/elevator arrives',
  6: 'player enters', 7: 'all team players inside',
  9: 'use key, red team', 10: 'use key, blue team',
  13: 'red player enters', 14: 'blue player enters',
  17: 'bot enters', 18: 'enemy bot enters',
});

export const MODEL_TEXT = Object.freeze({
  unknownMode: (mode: unknown) => `mode ${String(mode as number)}`,
  noTarget: '-',
  unlimited: 'unlimited',
  callsLeft: (calls: unknown, max: unknown) => `${String(calls as number)}/${String(max as number)} left`,
  label: (index: number, uid: unknown) => `#${index}${uid ? ` ${String(uid as string)}` : ''}`,
  named: (what: string, index: number, uid: unknown) => `${what} #${index}${uid ? ` ${String(uid as string)}` : ''}`,
  regionAt: (named: string, atX: number, atY: number, mode: string) => `${named} at ${atX}, ${atY} (${mode})`,
  chatMessage: 'chat message',
  deathOf: (index: number, nickname: unknown) => `death of #${index}${nickname ? ` ${String(nickname as string)}` : ''}`,
  continuesIn: (by: string) => `${by} (continues in it)`,
  viaRegion: (by: string, region: number) => `${by} (via region #${region})`,
  mapStart: 'map start',
  region: 'region',
  timer: 'timer',
  trigger: 'trigger',
});

export const RUN_TEXT = Object.freeze({
  disabledOrUsedUp: 'it is disabled or used up for the other players',
  forcedPastRegion: 'forced past the region\'s own condition',
  asAnother: '"as" another character only works in your game',
  spectating: 'you are spectating',
  isDisabled: 'is disabled',
  noCallsLeft: (calls: string) => `has no calls left (${calls})`,
  notUsable: (label: string, why: string, forceHint: string) => `trigger ${label} ${why}. "${forceHint}" runs it anyway.`,
  ran: (what: string, by: string, actions: string, state: string, where: string) => `Ran ${what}${by} (${actions})${state}${where}`,
  asCharacter: (index: number) => ` as #${index}`,
  sentToAll: ', sent to all players',
  forcedKept: ', forced: enabled state and calls left kept',
  calls: (calls: string) => `, calls ${calls}`,
  actionNoun: 'action',
  localOnly: (why: string) => `Note: ran in your game only, other players do not see it: ${why}.`,
  noSuchObject: (line: number, kind: string, value: string, name: string, side: string) => `line ${line}: this map has no ${kind} ${value} (${name} target ${side})`,
});

export const REGION_TEXT = Object.freeze({
  forTeam: (team: number, index: number, actual: unknown) => `it is for team ${team}; #${index} is on team ${String(actual as number)}`,
  onlyOwnUseKey: 'only your own use key fires it',
  notFromVehicle: 'not from a vehicle',
  neverFires: 'it never fires by itself',
  notInVehicle: 'not for a character in a vehicle',
  onlyInVehicle: 'only for a character in a vehicle',
  doorArrives: 'it fires when a door or elevator arrives, not for a character',
  onlyPlayers: 'only for players, not bots',
  notDead: 'not for the dead',
  onlyYourselfMultiplayer: 'in multiplayer only for yourself',
  onlyYourself: 'only for yourself',
  onlyBots: 'only for bots',
  onlyEnemyBots: 'only for bots on another team',
  unknownMode: (mode: unknown) => `unknown mode ${String(mode as number)}`,
  noRegion: (index: number, count: number) => `no region #${index}. This map has ${count}.`,
  runsNothing: (label: string) => `region ${label} runs nothing`,
  wouldNotFire: (label: string, mode: string, activator: number, why: string, index: number) => `region ${label} (${mode}) would not fire for #${activator}: ${why}. "regions run ${index} force" fires it anyway.`,
  forcedPast: (why: string) => `  forced past its condition: ${why}`,
  teamNotChecked: '  (the game also waits for every player of the team to be inside; not checked)',
  noTimer: (label: string, timer: number) => `region ${label} starts timer #${timer}, which does not exist`,
  startedTimer: (label: string, timer: number, uid: string | undefined) => `Fired region ${label}: started timer #${timer}${uid ? ` ${uid}` : ''}`,
  timerLocalOnly: 'Note: in your game only. For a timer region the game sends a trigger run with the timer\'s number, which would run the wrong trigger for everyone else, so nothing is sent.',
  noTrigger: (label: string, trigger: number) => `region ${label} runs trigger #${trigger}, which does not exist`,
  forceHint: (index: number) => `regions run ${index} force`,
  ranVia: (label: string, trigger: string) => `region ${label}: trigger ${trigger}`,
});

export const SCRIPT_TEXT = Object.freeze({
  opName: (type: number) => `op${type}`,
  where: (line: number, text: string) => `line ${line} "${text}"`,
  expectedAction: (where: string) => `${where}: expected Name( "A", "B" );`,
  didYouMean: (names: readonly string[]) => ` Did you mean ${names.join(' or ')}?`,
  notLoaded: ' Action names are not loaded: run "npm run fetch-opcodes", or write op<number>.',
  searchHint: ' "triggers actions <text>" searches the names.',
  unknownAction: (where: string, name: string, hint: string) => `${where}: unknown action "${name}".${hint}`,
  notHeader: (where: string, key: string, headers: readonly string[]) => `${where}: "${key}" is not ${headers.join(', ')}`,
  notActionOrHeader: (where: string, headers: readonly string[]) => `${where}: not an action (Name( "A", "B" );) or a header (${headers.join(', ')})`,
  noActions: 'no actions in the script',
  headerLine: (key: string, value: string) => `${key}: ${value}`,
  searchText: (alias: string, type: number, description: string) => `${alias} op${type} ${description}`,
});

export const VARS_TEXT = Object.freeze({
  noVariables: 'no variables yet: they are created when a map loads',
  notSet: '(not set)',
  modeName: (mode: string, what: string) => `${mode} (${what})`,
  modes: Object.freeze({
    r: Object.freeze({ what: 'replace', how: 'sets it on every client, whatever they had' }),
    d: Object.freeze({ what: 'default', how: 'sets it only where it is unset or not a number' }),
    x: Object.freeze({ what: 'max', how: 'keeps the higher number, so it can only raise a value' }),
    n: Object.freeze({ what: 'min', how: 'keeps the lower number, so it can only lower a value' }),
    l: Object.freeze({ what: 'longest', how: 'sets it only where the new text is longer' }),
  }),
  notANumber: 'text is parsed as a number first, which gives NaN',
  assigns: 'assigns it outright',
  numberKept: 'the old value is a number, so it is kept',
  textOverwrites: 'any text counts as "not a number", so it is overwritten',
  higherKept: 'clients holding a higher number keep theirs',
  lowerKept: 'clients holding a lower number keep theirs',
  longerOnly: (length: number, suffix: string, numeric: boolean) => `only clients whose value is under ${length} character${suffix}${numeric ? ', which compares a number as text' : ''}`,
  unknownMode: 'unknown mode',
});

export const RUN_LOG_TEXT = Object.freeze({ disabled: 'disabled', noCallsLeft: 'no calls left' });
