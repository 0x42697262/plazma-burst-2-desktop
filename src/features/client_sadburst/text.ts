export const TEXT = Object.freeze({
  flagOff: (title: string, feature: string): string => `${title} is off (feature flag "${feature}"); not starting it.`,
});
