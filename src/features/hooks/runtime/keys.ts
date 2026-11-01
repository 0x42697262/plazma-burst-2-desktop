export const RUNTIME_KEY = Object.freeze({ multiplayer: 'mp', network: 'net', post: 'POST' });
export const getterSource = (name: string): string => `(() => typeof ${name} === 'undefined' ? undefined : ${name})`;
export const setterSource = (name: string): string => `((v) => { ${name} = v; })`;
