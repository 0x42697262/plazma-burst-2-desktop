import { PING_GOOD_MS, PING_OK_MS } from '../constants.ts';
import { LAUNCHER_BRIDGE } from '../keys.ts';
import { LAUNCHER_TEXT } from '../text.ts';
import { CHECK_STATE, FIELD, LAUNCHER_CLASS, LAUNCHER_ELEMENT, LAUNCHER_EVENT, LAUNCHER_FIELDS, LAUNCHER_KEY, PASSWORD_FIELD, fieldSelector, hostPortOf } from './keys.ts';

type Server = { id: string; name: string; address: string; fingerprint?: string; nickname?: string; hasPassword?: boolean };
type Official = { id: string; name: string; host: string; port: number; description: string };
type Row = Server & { official?: boolean; description?: string };
type Status = { name?: string; description?: string; version?: string; password?: boolean; players?: number; max_players?: number; matches?: number };
type Check = { ping: number | null; status?: Status; error?: string; pinned?: boolean };
type CheckState = Check | typeof CHECKING | undefined;
type ClientChoice = { id: string; title: string };
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
};
type Child = Node | string | null | undefined | false | Child[];

const CHECKING = CHECK_STATE.checking;
const api = Reflect.get(window, LAUNCHER_BRIDGE) as Bridge | undefined;
const query = <Found extends Element>(selector: string): Found => document.querySelector(selector) as Found;

let data: ListData | null = null;
let selected: string | null = null;
const checks = new Map<string, CheckState>();
let editing: Server | null = null;

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

const rows = (): Row[] => (data ? [{ ...data.official, official: true, address: hostPortOf(data.official.host, data.official.port) }, ...data.servers] : []);
const isDone = (state: CheckState): state is Check => state !== undefined && state !== CHECKING;

function pingCell(state: CheckState): HTMLElement {
  if (!isDone(state)) return element('span', { class: LAUNCHER_CLASS.muted }, LAUNCHER_TEXT.checking);
  if (state.ping === null) return element('span', { class: LAUNCHER_CLASS.bad }, LAUNCHER_TEXT.offline);
  const milliseconds = Math.round(state.ping);
  const quality = milliseconds < PING_GOOD_MS ? LAUNCHER_CLASS.good : milliseconds < PING_OK_MS ? LAUNCHER_CLASS.warn : LAUNCHER_CLASS.bad;
  return element('span', { class: quality }, LAUNCHER_TEXT.pingMs(milliseconds));
}

function playersCell(row: Row, state: CheckState): string {
  if (row.official || !isDone(state) || !state.status) return LAUNCHER_TEXT.noPlayers;
  const { players = 0, max_players: maxPlayers = 0, matches = 0 } = state.status;
  return LAUNCHER_TEXT.players(players, maxPlayers, matches);
}

function descriptionCell(row: Row, state: CheckState): Child {
  if (row.official) return row.description ?? '';
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
    element('td', { class: LAUNCHER_CLASS.name }, name, element('span', { class: LAUNCHER_CLASS.tag }, row.official ? LAUNCHER_TEXT.officialTag : LAUNCHER_TEXT.privateTag)),
    element('td', { class: LAUNCHER_CLASS.address }, row.address),
    element('td', { class: LAUNCHER_CLASS.number }, pingCell(state)),
    element('td', { class: LAUNCHER_CLASS.number }, playersCell(row, state)),
    element('td', { class: LAUNCHER_CLASS.description }, descriptionCell(row, state))));
  }
  const isPrivateSelected = data.servers.some((server) => server.id === selected);
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.edit).disabled = !isPrivateSelected;
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.remove).disabled = !isPrivateSelected;
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.play).disabled = !selected;
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
  drawOtherClients(bridge, loaded.otherClients ?? []);
  for (const row of rows()) void check(bridge, row.id);
}

function drawOtherClients(bridge: Bridge, clients: readonly ClientChoice[]): void {
  const box = query<HTMLParagraphElement>(LAUNCHER_ELEMENT.otherClients);
  box.hidden = !clients.length;
  box.replaceChildren(LAUNCHER_TEXT.otherClients, ...clients.map((client) => {
    const button = element('button', {}, LAUNCHER_TEXT.playClient(client.title)) as HTMLButtonElement;
    button.addEventListener(LAUNCHER_EVENT.click, () => {
      button.disabled = true;
      void bridge.switchClient(client.id);
    });
    return button;
  }));
}

async function play(id: string | null): Promise<void> {
  if (!id || !api) return;
  const button = query<HTMLButtonElement>(LAUNCHER_ELEMENT.play);
  button.disabled = true;
  try {
    await api.play(id);
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

function wire(bridge: Bridge): void {
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
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.refresh).addEventListener(LAUNCHER_EVENT.click, () => { for (const row of rows()) void check(bridge, row.id); });
  query<HTMLButtonElement>(LAUNCHER_ELEMENT.play).addEventListener(LAUNCHER_EVENT.click, () => { void play(selected); });
  document.addEventListener(LAUNCHER_EVENT.keyDown, (event) => {
    if (form.open) return;
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
