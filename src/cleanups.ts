import { untracked } from "@preact/signals-core";
import { defer } from "./defer";

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

var currentJob: Job<any>;

export type JobGenerator<T=void> = Generator<void,T,any>
export type Awaiting<T> = Generator<void, T, any>;

/**
 * Create a new job or fetch the currently-running one
 *
 * @param g (Optional) A generator, or a no-argument generator function, that
 * will run as the job.  If not given, return the current job.  (Note that since
 * arrow functions can't be generators, functions used to start a job cannot
 * use `this`.  If you need a job function to have a `this`, make it a method
 * and call it, or use {@link spawn} instead.)
 *
 * @returns A new Job instance, or the current job (which may be undefined).
 */
export function job<R>(g?: JobGenerator<R> | ((this:void) => JobGenerator<R>) ): Job<R> {
    return g ? (new _Job(typeof g === "function" ? g() : g)) : currentJob; }

/**
 * Create a new job from a context (`this`) and generator function
 *
 * @param thisArg The desired `this` for the generator function to receive
 * @param gf The generator function to be run in the new job.
 * @returns The new job
 */
export function spawn<T,R>(thisArg: T, gf: (this: T) => JobGenerator<R>): Job<R> {
    return job(gf.call(thisArg) as JobGenerator<R>);
}

export interface Job<T> extends PromiseLike<T> {
    next(v?: any): void;
    return(v?: T): void;
    throw(e: any): void;

    /** Run a cleanup function when the job ends */
    cleanup(f: Cleanup): void;
}

const IS_RUNNING = 1, IS_FINISHED = 2, IS_ERROR = 4 | IS_FINISHED, WAS_PROMISED = 8;

class _Job<T> implements Job<T> {
    constructor(protected g: JobGenerator<T>) {
        // Ensure the job stops when its parent does
        const doStop = this.return.bind(this, undefined);
        cleanup(doStop);

        // As the last step of stopping, remove our doStop callback
        // from the parent context, so contexts that spawn lots of
        // jobs don't keep needlessly growing their cleanup lists
        const parentCtx = cleanupContext;
        this._ctx.push(() => {
            const idx = parentCtx.indexOf(doStop);
            if (idx >= 0) parentCtx.splice(idx, 1);

            // Check for untrapped error, promote to unhandled rejection
            if ((this._flags & (IS_ERROR | WAS_PROMISED)) === IS_ERROR) {
                Promise.reject(this._result);
            }
        })

        // Start asynchronously
        defer(() => { this._flags &= ~IS_RUNNING; this.next(); });
    }

    then<T1=T, T2=never>(
        onfulfilled?: (value: T) => T1 | PromiseLike<T1>,
        onrejected?: (reason: any) => T2 | PromiseLike<T2>
    ): Promise<T1 | T2> {
        this._flags |= WAS_PROMISED;
        return new Promise((res, rej) => this.cleanup(() => {
            if ((this._flags & IS_ERROR) === IS_ERROR) rej(this._result); else res(this._result);
        })).then(onfulfilled, onrejected);
    }

    catch<T>(onrejected?: (reason: any) => T | PromiseLike<T>): Promise<T> {
        return this.then(undefined, onrejected);
    }

    next(v?: any)   { if (this.g) this._step("next",   v); }
    return(v?: T)   { if (this.g) this._step("return", v); }
    throw(e: any)   { if (this.g) this._step("throw",  e); }


    cleanup(f: Cleanup) {
        this._ctx.push(f);
        // Already closed?  Defer it to run anyway
        if (this._ctx.length === 1 && !this.g) defer(runCleanups.bind(this._ctx));
    }

    // === Internals === //

    protected readonly _ctx: CleanupContext = [];
    protected _flags = IS_RUNNING;
    protected _result: any

    protected _step(method: "next" | "throw" | "return", arg: any) {
        // Don't resume a job while it's running
        if (this._flags & IS_RUNNING) return defer(this._step.bind(this, method, arg));
        const oldCtx = cleanupContext;
        try {
            this._flags |= IS_RUNNING;
            currentJob = this;
            cleanupContext = this._ctx;
            try {
                const res: IteratorResult<any, T> = untracked(this.g[method].bind(this.g, arg));
                if (!res.done) return;
                this._result = res.value;
                this._flags |= IS_FINISHED;
            } catch(e) {
                this._result = e;
                this._flags |= IS_ERROR
            }
            // Generator returned or threw: ditch it and run cleanups
            this.g = undefined;
            runCleanups.call(this._ctx);
        } finally {
            currentJob = undefined;
            cleanupContext = oldCtx;
            this._flags &= ~IS_RUNNING;
        }
    }
}
