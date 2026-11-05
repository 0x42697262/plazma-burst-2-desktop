import { ESCAPED_SCRIPT_END, SADBURST_TOKEN_KEY, SCRIPT_END, removeTokenScript, setTokenScript } from '../keys.ts';

const scriptJson = (value: string): string => JSON.stringify(value).replace(SCRIPT_END, ESCAPED_SCRIPT_END);

export const tokenScript = (token: string | null): string => (token === null
  ? removeTokenScript(scriptJson(SADBURST_TOKEN_KEY))
  : setTokenScript(scriptJson(SADBURST_TOKEN_KEY), scriptJson(token)));
