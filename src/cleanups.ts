/**
 * This module's original functionality is now obsoleted by uneventful; please
 * use its APIs instead, as these will be removed entirely in Ophidian 0.1.x.
 */

import {
    Job, Yielding, getJob, isJobActive, makeJob, start, PlainFunction, OptionalCleanup, CleanupFn,
    detached, must,
} from "uneventful";
export { type Job, type OptionalCleanup } from "uneventful";

/** @deprecated Use {@link CleanupFn} from uneventful instead */
type Cleanup = CleanupFn

/**
 * @deprecated Use job APIs from uneventful instead
 *
 * A savepoint is a way to clean up a collection of related resources
 * or undo actions taken by rules, effects, or jobs.  By adding
 * "cleanups" -- zero-argument callbacks -- to a savepoint, you can
 * later call its `rollback()` method to run all of them in reverse
 * order, thereby undoing actions or disposing of used resources.
 *
 * The `savepoint` export lets you create `new savepoint()` instances,
 * and perform operations on the "current" savepoint, if there is one.
 * e.g. `savepoint.add(callback)` will add `callback` to the active
 * savepoint, or throw an error if there is none.  (You can use
 * `savepoint.active` to check if there is a currently active
 * savepoint, or make one active using its `.run()` method.)
 *
 * @category Targeted for Removal
 */
interface savepoint extends ActiveSavePoint {
    /** Is there a currently active savepoint? */
    readonly active: boolean;

    /**
     * @deprecated Use {@link detached}.start(action) instead
     *
     * Create a savepoint, optionally capturing cleanup callbacks from a
     * supplied function.
     *
     * If a function is supplied, it will be run with the new savepoint active
     * (so that `savepoint.add()` and the like will work).  If the function
     * returns a function, it will be added to the new savepoint's cleanup
     * callbacks.  If the function throws an error, the savepoint will be rolled
     * back, and the error re-thrown.
     */
    new(action?: () => OptionalCleanup): SavePoint;
}

/**
 * @deprecated Use job APIs from uneventful instead
 * @category Targeted for Removal
 */
export interface ActiveSavePoint {
    /**
     * Add zero or more cleanup callbacks to be run when the savepoint is rolled
     * back. Non-function values are ignored.
     */
    add(...cleanups: OptionalCleanup[]): void;

    /**
     * Create a single-use subordinate savepoint that rolls back if its parent
     * does.  (For long-lived parent savepoints that sequentially spin off lots
     * of subordinate savepoints.)
     *
     * This is similar to calling `subtask = new savepoint();
     * parent.add(subtask.rollback);`, but with an important difference: when
     * the subtask savepoint rolls back, it will remove its rollback from the
     * parent savepoint.  This prevents a lot of useless callbacks accumulating
     * in the parent savepoint.
     *
     * (Note that the link is a one-time thing: if you reuse the task savepoint
     * after it's been rolled back, you'll need to use `parent.link(child,
     * stop?)` to re-attach it to the parent (or attach it to a different one)
     *
     * @param stop The function the parent should call to roll back the subtask;
     * defaults to the new task's `rollback()` method if not given.
     * @returns A new linked savepoint
     */
    subtask(stop?: Cleanup): SavePoint

    /**
     * Link a child savepoint to this savepoint, such that the child will remove
     * itself from the parent.
     *
     * Similar to {@link subtask()}, except that you supply the child savepoint
     * instead of it being created automatically.
     *
     * @param subtask The savepoint to link.
     * @param stop The function the parent should call to roll back the subtask;
     * defaults to the subtask's `rollback()` method if not given.
     * @returns The subtask savepoint.
     */
    link(subtask: SavePoint, stop?: Cleanup): SavePoint
}

/**
 * @deprecated Use job APIs from uneventful instead
 * @category Targeted for Removal
 */
export interface SavePoint extends ActiveSavePoint {
    /**
     * Call all the added cleanup callbacks; if any throw exceptions, they're
     * converted to unhandled promise rejections (so that all cleanups can
     * be called even if one throws an error).
     */
    rollback(): void;

    /**
     * Invoke a function with this savepoint as the active one, so that `savepoint.add()`
     * will add things to it, `savepoint.subtask()` will fork it, and so on.
     *
     * @param fn The function to call
     * @param args The arguments to call it with, if any
     * @returns The result of calling fn(...args)
     */
    run<F extends PlainFunction>(fn?: F, ...args: Parameters<F>): ReturnType<F>
}

var wrappers = new WeakMap<Job, SavePoint>();

class spWrapper implements SavePoint {
    constructor(public job: Job<unknown>) {
        wrappers.set(job, this);
    }
    rollback = this.job.end;
    run<F extends PlainFunction>(fn?: F, ...args: Parameters<F>): ReturnType<F> {
        return this.job.run(fn, ...args);
    }
    add(...cleanups: OptionalCleanup[]): void { for (const c of cleanups) this.job.must(c); }
    subtask(stop?: Cleanup): SavePoint { return new spWrapper(makeJob(this.job, stop)); }
    link(subtask: SavePoint, stop?: Cleanup): SavePoint {
        stop ||= subtask.rollback;
        subtask.add(this.job.release(stop));
        return subtask;
    }
}

/** @deprecated Use job APIs from uneventful instead */
export let savepoint: savepoint = class extends spWrapper {
    constructor(action?: () => OptionalCleanup) { super(detached.start(action)); }
    static get active() { return isJobActive(); }
    static add(...cleanups: OptionalCleanup[]): void { cleanups.forEach(must); }
    static subtask(fn?: Cleanup) { return new spWrapper(fn ? makeJob(undefined, fn) : start()); }
    static link(subtask: SavePoint, stop: Cleanup = subtask.rollback) {
        subtask.add(getJob().release(stop));
        return subtask;
    }
}


/** @deprecated Use {@link isJobActive}() instead  @category Targeted for Removal */
export function canCleanup() { return isJobActive(); }

/** @deprecated Use {@link must}()` instead  @category Targeted for Removal */
export function cleanup(...cleanups: OptionalCleanup[]) { cleanups.forEach(must); }

/** @deprecated Use {@link detached}.start(action).end instead  @category Targeted for Removal */
export function withCleanup(action: () => OptionalCleanup): Cleanup;
export function withCleanup(action: () => OptionalCleanup, optional: false): Cleanup;
export function withCleanup(action: () => OptionalCleanup, optional: true): OptionalCleanup;
export function withCleanup(action: () => OptionalCleanup, optional?: boolean): OptionalCleanup {
    return detached.start(action).end;
}

/**
 * @deprecated Use job APIs from uneventful instead
 * @category Targeted for Removal
 */
export type JobGenerator<T=void> = Generator<void,T,any>

/**
 * @deprecated Use job APIs from uneventful instead
 * @category Targeted for Removal
 */
export type Awaiting<T> = Generator<void, T, any>;

/**
 * @deprecated Use start() from uneventful
 *
 * Create a new job or fetch the currently-running one
 *
 * If no arguments given, returns the current job (if any).  If one argument is
 * given, it should be either a generator, or a no-arguments generator function.
 *
 * If two arguments are given, the second should be a no-arguments generator
 * function, and the first is the `this` object the function should be called
 * with.  (This two-argument form is needed since you can't make generator
 * arrows in JS yet.)
 *
 * Note that TypeScript and/or VSCode may require that you give the function an
 * explicit `this` parameter (e.g. `job(this, function *(this) {...}));`) in
 * order to correctly infer types inside the generator function.
 *
 * @returns A new Job instance, or the current job (which may be undefined).
 *
 * @category Targeted for Removal
 */
export function job<R,T>(thisObj: T, fn: (this:T) => Yielding<R>): Job<R>
/** @deprecated use start() from uneventful */
export function job<R>(fn: (this:void) => Yielding<R>): Job<R>
/** @deprecated use start() from uneventful */
export function job<R>(g: Yielding<R>): Job<R>
export function job<R>(
    g?: Yielding<R> | ((this:void) => Yielding<R>),
    fn?: () => Yielding<R>
): Job<R> {
    if (g || fn) return start(g, fn);
}

/**
 * @deprecated Use start(thisArg, function*(this) { ... })` from uneventful instead.
 * @category Targeted for Removal
 */
export function spawn<T,R>(thisArg: T, gf: (this: T) => Yielding<R>): Job<R> {
    return start(thisArg, gf);
}
