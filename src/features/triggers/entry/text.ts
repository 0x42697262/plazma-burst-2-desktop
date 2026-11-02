export const TRIGGERS_TEXT = Object.freeze({
  actionName: (what: string | undefined) => (what ? `  (${what})` : ''),
  noTriggers: 'This map has no triggers',
  sourceSeparator: '; ',
  actionNoun: 'action',
  flagSeparator: ', ',
  triggerNoun: 'trigger',
});
