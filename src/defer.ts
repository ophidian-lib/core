/** Invoke a no-argument function as a microtask, using queueMicrotask or Promise.resolve().then() */
export const defer: (cb: () => any) => void = window.queueMicrotask ?? (p => (cb: () => any) => p.then(cb))(Promise.resolve());

/**
 * Return a queuing function that invokes callbacks serially, returning a promise for the task's completion
 *
 * The returned function has a signature that's equivalent to Promise<void>.then() - i.e., it takes an
 * optional onfulfilled and onrejected callback.  If no onrejected callback is supplied, `console.error`
 * is used.
 */
export function taskQueue() {
    let last = Promise.resolve();
    return (onfulfilled?: (val: any) => void|PromiseLike<void>, onrejected?: (reason: any) => void|PromiseLike<void>) => {
        if (onfulfilled || onrejected) {
            if (typeof onrejected === "undefined") onrejected = console.error;
            return last = last.then(onfulfilled, onrejected);
        }
        return last;
    }
}
