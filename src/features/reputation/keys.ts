export const COMMAND = Object.freeze({ name: 'rep', aliases: Object.freeze(['reputation']) });
export const RELATIONS_COMMAND = Object.freeze({ name: 'relations', aliases: Object.freeze(['rel']) });
export const PLAYERS_COMMAND = Object.freeze({ name: 'players', aliases: Object.freeze(['match']) });
export const LIST_MESSAGE = 'RELIABLE_GET_MATCH_LIST';
export const LIST_FILTER = '{}';
export const VIEW = Object.freeze({ matches: 'match_list', relations: 'relations' });
export const REPLY_OK = 'ok';
export const REPLY_PART = Object.freeze({ status: 0, rows: 1, own: 2 });
