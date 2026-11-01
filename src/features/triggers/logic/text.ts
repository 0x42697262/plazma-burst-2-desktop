export const TEXT = Object.freeze({
  actionLabel: (action: number, type: number, name: string | undefined) => `action ${action}: ${type}${name ? ` ${name}` : ''}`,
});
