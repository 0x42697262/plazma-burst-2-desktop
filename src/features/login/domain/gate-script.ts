import { ESCAPED_SCRIPT_END, GATE_STORAGE, SCRIPT_END, removeGateScript, setGateScript } from '../keys.ts';

const scriptJson = (value: string): string => JSON.stringify(value).replace(SCRIPT_END, ESCAPED_SCRIPT_END);

export const gateScript = (login: string, passwordCookie: string): string => setGateScript(
  scriptJson(GATE_STORAGE.login),
  scriptJson(login),
  scriptJson(GATE_STORAGE.password),
  scriptJson(passwordCookie),
);

export const clearGateScript = (): string => removeGateScript(scriptJson(GATE_STORAGE.login), scriptJson(GATE_STORAGE.password));
