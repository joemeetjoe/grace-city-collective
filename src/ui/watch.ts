/**
 * A value an outside source keeps current — an observer's report, a timer's
 * tick — in the shape `useSyncExternalStore` takes. The one primitive under
 * the ui hooks that watch something (useInView, useInTurn): each makes a
 * watch for its inputs, so a change of inputs is a fresh watch from its
 * initial value, and React subscribes and lets go with the mount (useWatch).
 */
export type Watch<T> = {
  /** start the source for the first subscriber, and tell each on every change */
  subscribe: (onChange: () => void) => () => void;
  /** the latest value: the initial one until the source reports */
  getSnapshot: () => T;
};

/**
 * A watch over `start`: called with a setter when the first subscriber
 * arrives, it starts the source and returns how to stop it, which runs
 * when the last subscriber leaves. The value survives a stop and a restart
 * (StrictMode subscribes twice), and a report equal to the current value
 * (`Object.is`) tells no one.
 */
export function createWatch<T>(initial: T, start: (set: (value: T) => void) => () => void): Watch<T> {
  let value = initial;
  let stop: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe(onChange) {
      listeners.add(onChange);
      stop ??= start(set);
      return () => {
        listeners.delete(onChange);
        if (listeners.size > 0 || !stop) return;
        stop();
        stop = null;
      };
    },
    getSnapshot: () => value,
  };
}
