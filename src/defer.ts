/** Invoke a no-argument function as a microtask, using queueMicrotask or Promise.resolve().then() */
export const defer: (cb: () => any) => void = typeof queueMicrotask === "function" ? queueMicrotask : (p => (cb: () => any) => p.then(cb))(Promise.resolve());

/**
 * Return a queuing function that invokes callbacks serially, returning a promise for the task's completion
 *
 * The returned function takes a zero-argument callback which can return a value or an error, and returns
 * a promise for the result of that callback.  The callback will not be run until after all previous callbacks
 * have run.  If no callback is supplied to the queue, the promise returned is for the most-recently-executed
 * callback.
 *
 * @category Targeted for Removal
 */
export function taskQueue() {
    let last: Promise<any> = Promise.resolve();
    return <T>(action?: () => T|PromiseLike<T>) => {
        return !action ? last : last = new Promise<T>(
            (res, rej) => last.finally(
                () => { try { res(action()); } catch(e) { rej(e); } }
            )
        )
    }
}
