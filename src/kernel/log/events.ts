export const KERNEL_EVENT = Object.freeze({
  flagsResolved: 'flags.resolved',
  configInvalid: 'config.invalid',
});
export type KernelEvent = typeof KERNEL_EVENT[keyof typeof KERNEL_EVENT];
