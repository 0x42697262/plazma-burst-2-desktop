import { PING_GOOD_MS, PING_OK_MS } from '../constants.ts';
import { LAUNCHER_BRIDGE } from '../keys.ts';
import { LAUNCHER_TEXT } from '../text.ts';
import { CHECK_STATE, FIELD, LAUNCHER_CLASS, LAUNCHER_ELEMENT, LAUNCHER_EVENT, LAUNCHER_FIELDS, LAUNCHER_KEY, LOGIN_FIELD, CLIENT_ROW_PREFIX, PASSWORD_FIELD, fieldSelector, hostPortOf } from './keys.ts';

type Server = { id: string; name: string; address: string; fingerprint?: string; nickname?: string; hasPassword?: boolean };
type Official = { id: string; name: string; host: string; port: number; description: string };
type Row = Server & { official?: boolean; description?: string; clientId?: string };
type Status = { name?: string; description?: string; version?: string; password?: boolean; players?: number; max_players?: number; matches?: number };
type Check = { ping: number | null; status?: Status; error?: string; pinned?: boolean };
type CheckState = Check | typeof CHECKING | undefined;
type ClientChoice = { id: string; title: string; host?: string };
type Account = { login: string; active: boolean; updatedAt: string };
type Accounts = { accounts: Account[]; canLogIn: boolean; overridden: boolean };
type ListData = { official: Official; servers: Server[]; last: string | null; gameVersion: string | null; problems: string[]; otherClients?: ClientChoice[] };
type SaveResult = { errors?: string[]; server?: Server };
type Bridge = {
  list(): Promise<ListData>;
  save(entry: Record<string, unknown>): Promise<SaveResult>;
  remove(id: string): Promise<boolean>;
  check(id: string): Promise<Check>;
  fingerprint(address: string): Promise<string>;
  play(id: string): Promise<boolean>;
  switchClient(id: string): Promise<boolean>;
  accounts(client: string): Promise<Accounts | null>;
  useAccount(client: string, login: string): Promise<boolean>;
  removeAccount(client: string, login: string): Promise<boolean>;
  logIn(client: string, login?: string, password?: string): Promise<string | null>;
};
type Child = Node | string | null | undefined | false | Child[];

const CHECKING = CHECK_STATE.checking;
const api = Reflect.get(window, LAUNCHER_BRIDGE) as Bridge | undefined;
const query = <Found extends Element>(selector: string): Found => document.querySelector(selector) as Found;

let data: ListData | null = null;
let selected: string | null = null;
const checks = new Map<string, CheckState>();
let editing: Server | null = null;
let accountsDrawnFor: string | null = null;

function flatten(children: readonly Child[]): (Node | string)[] {
  const flat: (Node | string)[] = [];
  for (const child of children) {
    if (Array.isArray(child)) flat.push(...flatten(child));
    else if (child !== null && child !== undefined && child !== false) flat.push(child);
  }
  return flat;
}

function element(tag: keyof HTMLElementTagNameMap, attributes: Record<string, string | ((event: Event) => void)> = {}, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof value === 'function') node.addEventListener(name, value);
    else if (name === LAUNCHER_CLASS.attribute) node.className = value;
    else node.setAttribute(name, value);
  }
  for (const child of flatten(children)) node.append(child);
  return node;
}

const clientRows = (clients: readonly ClientChoice[]): Row[] => clients.map((client) => ({
  id: CLIENT_ROW_PREFIX + client.id, name: client.title, address: client.host ?? '', clientId: client.id, description: LAUNCHER_TEXT.clientDescription(client.title),
}));
const rows = (): Row[] => (data ? [{ ...data.official, official: true, address: hostPortOf(data.official.host, data.official.port) }, ...clientRows(data.otherClients ?? []), ...data.servers] : []);
const clientOfRow = (row: Row | undefined): string | null => (row?.official ? row.id : row?.clientId ?? null);
const isDone = (state: CheckState): state is Check => state !== undefined && state !== CHECKING;

function pingCell(row: Row, state: CheckState): HTMLElement {
  if (row.clientId) return element('span', { class: LAUNCHER_CLASS.muted }, LAUNCHER_TEXT.noPlayers);
  if (!isDone(state)) return element('span', { class: LAUNCHER_CLASS.muted }, LAUNCHER_TEXT.checking);
  if (state.ping === null) return element('span', { class: LAUNCHER_CLASS.bad }, LAUNCHER_TEXT.offline);
  const milliseconds = Math.round(state.ping);
  const quality = milliseconds < PING_GOOD_MS ? LAUNCHER_CLASS.good : milliseconds < PING_OK_MS ? LAUNCHER_CLASS.warn : LAUNCHER_CLASS.bad;
  return element('span', { class: quality }, LAUNCHER_TEXT.pingMs(milliseconds));
}

function playersCell(row: Row, state: CheckState): string {
  if (row.official || row.clientId || !isDone(state) || !state.status) return LAUNCHER_TEXT.noPlayers;
  const { players = 0, max_players: maxPlayers = 0, matches = 0 } = state.status;
  return LAUNCHER_TEXT.players(players, maxPlayers, matches);
}

function descriptionCell(row: Row, state: CheckState): Child {
  if (row.official || row.clientId) return row.description ?? '';
  const nickname = row.nickname ?? '';
  if (!isDone(state)) return nickname ? LAUNCHER_TEXT.asNickname(nickname) : LAUNCHER_TEXT.needsNickname;
  if (state.pinned === false) return element('span', { class: LAUNCHER_CLASS.bad }, LAUNCHER_TEXT.certificateChanged);
  if (!state.status) return element('span', { class: LAUNCHER_CLASS.muted }, state.ping === null ? LAUNCHER_TEXT.notReachable : state.error || '');
  const status = state.status;
  const parts: Child[] = [status.description || ''];
  const isOtherVersion = status.version && data?.gameVersion && status.version !== data.gameVersion;
  if (isOtherVersion) parts.push(element('div', { class: LAUNCHER_CLASS.warn }, LAUNCHER_TEXT.versionMismatch(status.version ?? '', data?.gameVersion ?? '')));
  const needsPassword = !!status.password && !row.hasPassword;
  parts.push(element('div', { class: LAUNCHER_CLASS.smallLine }, LAUNCHER_TEXT.asNicknameNeedsPassword(nickname, needsPassword)));
  return parts;
}

function draw(): void {
  if (!data) return;
  const body = query<HTMLTableSectionElement>(LAUNCHER_ELEMENT.rows);
  body.textContent = '';
  for (const row of rows()) {
    const state = checks.get(row.id);
    const name = row.official ? row.name : (isDone(state) && state.status?.name) || row.name;
    body.append(element('tr', {
      class: row.id === selected ? LAUNCHER_CLASS.selected : '',
      [LAUNCHER_EVENT.click]: () => { selected = row.id; draw(); },
      [LAUNCHER_EVENT.doubleClick]: () => { void play(row.id); },
    },
    element('td', { class: LAUNCHER_CLASS.name }, name, element('span', { class: LAUNCHER_CLASS.tag }, row.official ? LAUNCHER_TEXT.officialTag : row.clientId ? LAUNCHER_TEXT.clientTag : LAUNCHER_TEXT.privateTag)),
    element('td', { class: LAUNCHER_CLASS.address }, row.address),
    element('td', { class: LAUNCHER_CLASS.number }, pingCell(row, state)),
    element('td', { class: LAUNCHER_CLASS.number }, playersCell(row, state)),
    element('td', { class: LAUNCHER_CLASS.description }, descriptionCell(row, state))));
  }
  const isPrivateSelected = data.servers.some((server) => server.id === selected);
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.edit).disabled = !isPrivateSelected;
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.remove).disabled = !isPrivateSelected;
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.play).disabled = !selected;
  if (selected !== accountsDrawnFor) void drawAccounts();
}

function showAccountsNote(message: string, isProblem = false): void {
  const note = query<HTMLParagraphElement>(LAUNCHER_ELEMENT.accountsNote);
  note.hidden = !message;
  note.textContent = message;
  note.className = isProblem ? LAUNCHER_CLASS.bad : LAUNCHER_CLASS.smallLine;
}

async function drawAccounts(): Promise<void> {
  accountsDrawnFor = selected;
  const row = rows().find((candidate) => candidate.id === selected);
  const client = clientOfRow(row);
  const panel = query<HTMLElement>(LAUNCHER_ELEMENT.accounts);
  const accounts = api && client && row ? await api.accounts(client).catch(() => null) : null;
  if (accountsDrawnFor !== selected) return;
  panel.hidden = !accounts;
  if (!accounts || !row) return;
  query<HTMLElement>(LAUNCHER_ELEMENT.accountsTitle).textContent = LAUNCHER_TEXT.accountsTitle(row.name);
  const list = query<HTMLSelectElement>(LAUNCHER_ELEMENT.accountList);
  list.replaceChildren(...accounts.accounts.map((account) => {
    const option = element('option', { value: account.login }, LAUNCHER_TEXT.accountOption(account.login)) as HTMLOptionElement;
    option.selected = account.active;
    return option;
  }));
  if (!accounts.accounts.length) list.append(element('option', { value: '' }, LAUNCHER_TEXT.noAccounts));
  if (!accounts.accounts.some((account) => account.active) && accounts.accounts.length) list.selectedIndex = -1;
  list.disabled = !accounts.accounts.length;
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.accountRemove).disabled = !accounts.accounts.length;
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.accountNew).hidden = !accounts.canLogIn;
  showAccountsNote(accounts.overridden && client === data?.official.id ? LAUNCHER_TEXT.overridden : '');
}

async function check(bridge: Bridge, id: string): Promise<void> {
  checks.set(id, CHECKING);
  draw();
  try {
    checks.set(id, await bridge.check(id));
  } catch (error) {
    checks.set(id, { ping: null, error: (error as Error).message });
  }
  draw();
}

async function load(bridge: Bridge): Promise<void> {
  const loaded = await bridge.list();
  data = loaded;
  const isSelectedListed = rows().some((row) => row.id === selected);
  if (!selected || !isSelectedListed) selected = rows().some((row) => row.id === loaded.last) ? loaded.last : loaded.official.id;
  const note = query<HTMLParagraphElement>(LAUNCHER_ELEMENT.note);
  note.hidden = !loaded.problems.length;
  note.textContent = loaded.problems.length ? LAUNCHER_TEXT.fileProblems(loaded.problems) : '';
  draw();
  for (const row of rows()) if (!row.clientId) void check(bridge, row.id);
}

async function play(id: string | null): Promise<void> {
  if (!id || !api) return;
  const button = query<HTMLButtonElement>(LAUNCHER_ELEMENT.play);
  button.disabled = true;
  const clientRow = rows().find((row) => row.id === id && row.clientId);
  try {
    if (clientRow?.clientId) await api.switchClient(clientRow.clientId);
    else await api.play(id);
  } catch (error) {
    alert((error as Error).message);
    button.disabled = false;
  }
}

const form = query<HTMLDialogElement>(LAUNCHER_ELEMENT.form);
const field = (name: string): HTMLInputElement => form.querySelector(fieldSelector(name)) as HTMLInputElement;

function showErrors(list: readonly string[]): void {
  const errors = query<HTMLUListElement>(LAUNCHER_ELEMENT.errors);
  errors.textContent = '';
  for (const message of list) errors.append(element('li', {}, message));
  errors.hidden = !list.length;
}

function openForm(server: Server | null): void {
  editing = server;
  query<HTMLElement>(LAUNCHER_ELEMENT.formTitle).textContent = server ? LAUNCHER_TEXT.editTitle(server.name) : LAUNCHER_TEXT.addTitle;
  for (const name of LAUNCHER_FIELDS) field(name).value = server ? String(server[name as keyof Server] ?? '') : '';
  field(PASSWORD_FIELD).value = '';
  field(PASSWORD_FIELD).placeholder = server?.hasPassword ? LAUNCHER_TEXT.passwordUnchanged : '';
  showErrors([]);
  form.showModal();
  field(server ? FIELD.nickname : FIELD.address).focus();
}

const loginForm = query<HTMLDialogElement>(LAUNCHER_ELEMENT.loginForm);
const loginField = (name: string): HTMLInputElement => loginForm.querySelector(fieldSelector(name)) as HTMLInputElement;

function showLoginErrors(message: string): void {
  const errors = query<HTMLUListElement>(LAUNCHER_ELEMENT.loginErrors);
  errors.textContent = '';
  if (message) errors.append(element('li', {}, message));
  errors.hidden = !message;
}

function selectedClient(): string | null {
  return clientOfRow(rows().find((row) => row.id === selected));
}

function wireAccounts(bridge: Bridge): void {
  const redraw = (): Promise<void> => drawAccounts();
  query<HTMLSelectElement>(LAUNCHER_ELEMENT.accountList).addEventListener(LAUNCHER_EVENT.change, (event) => {
    const client = selectedClient();
    if (client) void bridge.useAccount(client, (event.target as HTMLSelectElement).value).catch((error: Error) => { showAccountsNote(error.message, true); });
  });
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.accountRemove).addEventListener(LAUNCHER_EVENT.click, () => {
    const client = selectedClient();
    const { value } = query<HTMLSelectElement>(LAUNCHER_ELEMENT.accountList);
    if (!client || !value || !confirm(LAUNCHER_TEXT.confirmRemoveAccount(value))) return;
    void bridge.removeAccount(client, value).then(redraw).catch((error: Error) => { showAccountsNote(error.message, true); });
  });
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.accountNew).addEventListener(LAUNCHER_EVENT.click, () => {
    const client = selectedClient();
    if (!client) return;
    if (client !== data?.official.id) {
      loginField(LOGIN_FIELD.login).value = '';
      loginField(LOGIN_FIELD.password).value = '';
      showLoginErrors('');
      loginForm.showModal();
      loginField(LOGIN_FIELD.login).focus();
      return;
    }
    showAccountsNote(LAUNCHER_TEXT.waitingForSite);
    void bridge.logIn(client).then(async (login) => {
      await redraw();
      showAccountsNote(login ? LAUNCHER_TEXT.loggedInAs(login) : LAUNCHER_TEXT.cancelled);
    }).catch((error: Error) => { showAccountsNote(error.message, true); });
  });
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.loginCancel).addEventListener(LAUNCHER_EVENT.click, () => loginForm.close());
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.loginSend).addEventListener(LAUNCHER_EVENT.click, (event) => {
    event.preventDefault();
    const client = selectedClient();
    if (!client) return;
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    showLoginErrors('');
    void bridge.logIn(client, loginField(LOGIN_FIELD.login).value, loginField(LOGIN_FIELD.password).value).then(async (login) => {
      loginField(LOGIN_FIELD.password).value = '';
      loginForm.close();
      await redraw();
      if (login) showAccountsNote(LAUNCHER_TEXT.loggedInAs(login));
    }).catch((error: Error) => { showLoginErrors(error.message); }).finally(() => { button.disabled = false; });
  });
}

function wire(bridge: Bridge): void {
  wireAccounts(bridge);
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.getFingerprint).addEventListener(LAUNCHER_EVENT.click, () => {
    const button = query<HTMLButtonElement>(LAUNCHER_ELEMENT.getFingerprint);
    button.disabled = true;
    bridge.fingerprint(field(FIELD.address).value)
      .then((fingerprint) => {
        field(FIELD.fingerprint).value = fingerprint;
        query<HTMLElement>(LAUNCHER_ELEMENT.fingerprintNote).textContent = LAUNCHER_TEXT.fingerprintFetched;
      })
      .catch((error: unknown) => showErrors([LAUNCHER_TEXT.fingerprintFailed((error as Error).message)]))
      .finally(() => { button.disabled = false; });
  });

  query<HTMLButtonElement>(LAUNCHER_ELEMENT.save).addEventListener(LAUNCHER_EVENT.click, (event) => {
    event.preventDefault();
    const entry: Record<string, unknown> = { id: editing ? editing.id : undefined };
    for (const name of LAUNCHER_FIELDS) entry[name] = field(name).value;
    const typedPassword = field(PASSWORD_FIELD).value;
    if (typedPassword || !editing) entry[PASSWORD_FIELD] = typedPassword;
    void bridge.save(entry).then(async (result) => {
      if (result.errors) {
        showErrors(result.errors);
        return;
      }
      form.close();
      selected = result.server?.id ?? null;
      await load(bridge);
    });
  });

  query<HTMLButtonElement>(LAUNCHER_ELEMENT.cancel).addEventListener(LAUNCHER_EVENT.click, () => form.close());
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.add).addEventListener(LAUNCHER_EVENT.click, () => openForm(null));
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.edit).addEventListener(LAUNCHER_EVENT.click, () => openForm(data?.servers.find((server) => server.id === selected) ?? null));
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.remove).addEventListener(LAUNCHER_EVENT.click, () => {
    const server = data?.servers.find((candidate) => candidate.id === selected);
    if (!server || !confirm(LAUNCHER_TEXT.confirmRemove(server.name))) return;
    void bridge.remove(server.id).then(() => {
      selected = data?.official.id ?? null;
      return load(bridge);
    });
  });
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.refresh).addEventListener(LAUNCHER_EVENT.click, () => { for (const row of rows()) if (!row.clientId) void check(bridge, row.id); });
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.play).addEventListener(LAUNCHER_EVENT.click, () => { void play(selected); });
  document.addEventListener(LAUNCHER_EVENT.keyDown, (event) => {
    if (form.open || loginForm.open) return;
    const isInAccounts = (event.target as Element).closest(LAUNCHER_ELEMENT.accounts) !== null;
    if (isInAccounts) return;
    if (event.key === LAUNCHER_KEY.enter) void play(selected);
    const isArrow = event.key === LAUNCHER_KEY.down || event.key === LAUNCHER_KEY.up;
    if (!isArrow) return;
    const list = rows();
    const index = list.findIndex((row) => row.id === selected);
    const step = event.key === LAUNCHER_KEY.down ? 1 : -1;
    selected = list[Math.max(0, Math.min(list.length - 1, index + step))]?.id ?? selected;
    draw();
    event.preventDefault();
  });
}

if (!api) {
  document.body.textContent = LAUNCHER_TEXT.outsideApp;
} else {
  wire(api);
  void load(api);
}
