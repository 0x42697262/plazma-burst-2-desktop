export type KeyLike = Readonly<{ code: string; key?: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean; repeat?: boolean }>;
export type KeyHandler = (event: KeyLike) => boolean;
export type PasteClaim = (text: string) => string | null;

const keyHandlers: KeyHandler[] = [];
const pasteClaims: PasteClaim[] = [];

export const provideKeyHandler = (handler: KeyHandler): void => { keyHandlers.push(handler); };
export const handledByAFeature = (event: KeyLike): boolean => keyHandlers.some((handler) => handler(event));

export const providePasteClaim = (claim: PasteClaim): void => { pasteClaims.push(claim); };
export const commandForPaste = (text: string): string | null => {
  for (const claim of pasteClaims) {
    const prefix = claim(text);
    if (prefix !== null) return prefix;
  }
  return null;
};
