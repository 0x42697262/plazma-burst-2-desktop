import { BY_APP_MARK, ESCAPED_SCRIPT_END, GATE_STORAGE, SCRIPT_END, removeGateScript, removeOwnGateScript, setGateScript } from '../keys.ts';

const scriptJson = (value: string): string => JSON.stringify(value).replace(SCRIPT_END, ESCAPED_SCRIPT_END);

const KEYS_JSON = Object.freeze({
  login: scriptJson(GATE_STORAGE.login),
  password: scriptJson(GATE_STORAGE.password),
  byApp: scriptJson(GATE_STORAGE.byApp),
  mark: scriptJson(BY_APP_MARK),
});

export const gateScript = (login: string, passwordCookie: string): string => setGateScript(KEYS_JSON, scriptJson(login), scriptJson(passwordCookie));

export const clearGateScript = (): string => removeGateScript(KEYS_JSON);

export const clearOwnGateScript = (): string => removeOwnGateScript(KEYS_JSON);
