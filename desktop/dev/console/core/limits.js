// Sizes that more than one part of the console depends on.

export const LOG_MAX = 500; // lines kept in the log pane; older ones are removed
// A page of a long list, plus its title and footer, has to fit in the log.
export const PAGE_SIZE_MAX = LOG_MAX - 20;
export const PAGE_SIZE_DEFAULT = 200;
