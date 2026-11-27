import { game } from '#console/kernel/game/bindings.ts';

type Bag = Record<string, unknown>;
type SaveBindings = Readonly<{
  loginParams(): { login: string; password: string };
  saveUrl(): string;
  saveData(): Bag;
  saveText(withDevice: boolean): string;
  saveUpload(): void;
  saveFlush(): void;
  saveApply(text: string): void;
  saveReplace(data: Bag): void;
  myAccount(): unknown;
}>;

export const gameSave = game as unknown as SaveBindings;

export function lobbyLogin(): string | null {
  const account = gameSave.myAccount();
  if (!account || typeof account !== 'object') return null;
  const login = (account as Bag).login;
  return typeof login === 'string' && login ? login : null;
}
