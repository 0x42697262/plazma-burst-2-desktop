export const STATE_HEADER_TEXT = Object.freeze({
  header: (written: boolean, isEverythingOn: boolean) => `State updates: ${written ? 'written' : 'counted only'}${isEverythingOn ? '' : ' (net_log_state)'}.`,
});
