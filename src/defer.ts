/** Invoke a no-argument function as a microtask, using queueMicrotask or Promise.resolve().then() */
export const defer: (cb: () => any) => void = window.queueMicrotask ?? (p => (cb: () => any) => p.then(cb))(Promise.resolve());

/**
 * Return a queuing function that invokes callbacks serially, returning a promise for the task's completion
 *
 * The returned function has a signature that's equivalent to Promise<void>.then() - i.e., it takes an
 * optional onfulfilled and onrejected callback.  If no onrejected callback is supplied, `console.error`
 * is used.
 */
export function taskQueue<T>(initalValue?: T) {
    let last = Promise.resolve(initalValue) as Promise<T>;
    return (onfulfilled?: (val: T) => T|PromiseLike<T>, onrejected?: (reason: any) => T|PromiseLike<T>) => {
        if (onfulfilled || onrejected) {
            if (typeof onrejected === "undefined") onrejected = console.error as typeof onrejected;
            return last = last.then(onfulfilled, onrejected);
        }
        return last;
    }
}
