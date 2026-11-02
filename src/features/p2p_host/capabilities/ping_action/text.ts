const pingActionsUsage = (actions: readonly string[]) => `server ping_action <${actions.join(' | ')}>`;

export const TEXT = Object.freeze({
  pingActionUsage: (actions: readonly string[]) => `usage: ${pingActionsUsage(actions)}`,
  subcommand: { usage: pingActionsUsage, desc: 'What happens over the ping limit ("-ping_action")' },
  ownerLine: (action: string) => `-ping_action ${action}`,
});
