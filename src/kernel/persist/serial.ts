export type SerialQueue = <Result>(task: () => Promise<Result>) => Promise<Result>;

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <Result>(task: () => Promise<Result>): Promise<Result> => {
    const done = tail.then(task);
    tail = done.catch(() => undefined);
    return done;
  };
}
