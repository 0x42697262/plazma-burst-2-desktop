export function oncePerKeyAtATime<Key, Value>(run: (key: Key) => Promise<Value>): (key: Key) => Promise<Value> {
  const running = new Map<Key, Promise<Value>>();
  return (key) => {
    const current = running.get(key);
    if (current) return current;
    const started = run(key).finally(() => { running.delete(key); });
    running.set(key, started);
    return started;
  };
}

export function onceUntilItFails(run: () => Promise<void>): () => Promise<void> {
  let done: Promise<void> | null = null;
  return () => {
    done ??= run().catch((error: unknown) => {
      done = null;
      throw error;
    });
    return done;
  };
}
