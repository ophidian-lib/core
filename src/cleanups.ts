type Nothing = undefined | null | void;
export type Cleanup = () => unknown;
export type OptionalCleanup = Cleanup | Nothing;

type CleanupContext = Cleanup[]
var cleanupContext: CleanupContext;

/** Return true if a withCleanup() call is active */
export function canCleanup() { return !!cleanupContext; }

/** Register cleanup function(s) for the enclosing effect, @rule, job, or withCleanup */
export function cleanup(...cleanups: Array<() => any>) {
    if (cleanupContext) cleanupContext.push(...cleanups); else throw new Error(
        "cleanup() must be called from within a job, effect, @rule, or withCleanup"
    );
}

/**
 * Aggregate cleanup functions registered during a function's execution
 *
 * @param action The function to run.  While running, any cleanup(), effect(), or @rule cleanups
 * will be added to a list.  If the action throws an error, cleanups registered up to that point
 * are called before the error propagates.
 * @returns A function that can be called to execute all registered cleanup functions, in reverse
 * order.  Any errors raised in cleanup functions are converted to promise rejections.
 * @param optional Pass true to get an undefined result if no cleanups were registered during
 * the action.  (Otherwise, a no-op function is returned if no cleanups were registered.)
 */
export function withCleanup(action: () => OptionalCleanup): Cleanup;
export function withCleanup(action: () => OptionalCleanup, optional: false): Cleanup;
export function withCleanup(action: () => OptionalCleanup, optional: true): OptionalCleanup;
export function withCleanup(action: () => OptionalCleanup, optional?: boolean): OptionalCleanup {
    const old = cleanupContext;
    const fx = cleanupContext = [] as CleanupContext;
    try {
        const cb = action?.();
        if (cb) fx.push(cb);
        if (fx.length || !optional) {
            return runCleanups.bind(fx);
        }
    } catch(e) {
        runCleanups.call(fx);
        throw e;
    } finally {
        cleanupContext = old;
    }
}

function runCleanups(this: CleanupContext) {
    while (this.length) try { this.pop()(); } catch (e) { Promise.reject(e); }
}

