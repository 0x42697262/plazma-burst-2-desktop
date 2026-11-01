export type KeyBinder = Readonly<{ bind(args: string[]): void; unbind(args: string[]): void }>;

let binder: KeyBinder | null = null;

export const provideKeyBinder = (provided: KeyBinder): void => { binder = provided; };

export const keyBinder = (): KeyBinder | null => binder;
