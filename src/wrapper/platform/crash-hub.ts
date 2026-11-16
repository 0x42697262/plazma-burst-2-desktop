type MainErrorListener = (error: Error) => void;
type RendererGoneListener = (reason: string, exitCode: number) => void;

export type CrashSources = Readonly<{
  onMainError(listener: MainErrorListener): void;
  onRendererGone(listener: RendererGoneListener): void;
  activeClient(): string;
}>;

export type CrashPorts = Readonly<{
  onMainError(listener: MainErrorListener): void;
  onRendererGone(listener: RendererGoneListener): void;
}>;

export function createCrashHub(sources: CrashSources) {
  const mainErrorListeners = new Map<string, MainErrorListener>();
  const rendererGoneListeners = new Map<string, RendererGoneListener>();
  let isListening = false;
  function listen(): void {
    if (isListening) return;
    isListening = true;
    sources.onMainError((error) => { mainErrorListeners.get(sources.activeClient())?.(error); });
    sources.onRendererGone((reason, exitCode) => { rendererGoneListeners.get(sources.activeClient())?.(reason, exitCode); });
  }
  const portsFor = (client: string): CrashPorts => Object.freeze({
    onMainError(listener: MainErrorListener) {
      listen();
      mainErrorListeners.set(client, listener);
    },
    onRendererGone(listener: RendererGoneListener) {
      listen();
      rendererGoneListeners.set(client, listener);
    },
  });
  return Object.freeze({ portsFor });
}
