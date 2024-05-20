import { untracked } from "@preact/signals-core";
import { defer } from "./defer.ts";

type Nothing = undefined | null | void;
/** @category Targeted for Removal */
export type Cleanup = () => unknown;
/** @category Targeted for Removal */
export type OptionalCleanup = Cleanup | Nothing;
type PlainFunction = (this: null, ...args: any[]) => any;

/**
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

/** @category Targeted for Removal */
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

/** @category Targeted for Removal */
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

var currentSP: SavePoint;

function getCurrent() {
    if (currentSP) return currentSP;
    throw new Error("no savepoint is currently active");
}

/** @category Targeted for Removal */
export let savepoint: savepoint & {
    /** @internal - used for effect scoping */
    wrapEffect(action: () => OptionalCleanup): () => OptionalCleanup
} = class implements SavePoint {

    constructor(action?: () => OptionalCleanup) {
        if (action) {
            const old = currentSP; currentSP = this;
            try {
                const cb = action();
                if (cb) this.add(cb);
            } catch (e) {
                this.rollback();
                throw e;
            } finally {
                currentSP = old;
            }
        }
    }

    static get active() { return !!currentSP; }
    static add(...cleanups: OptionalCleanup[]): void;
    static add() { getCurrent().add.apply(currentSP, arguments); }
    static subtask(fn?: Cleanup) { return getCurrent().subtask(fn); }
    static link(subtask: SavePoint, fn?: Cleanup) { return getCurrent().link(subtask, fn); }

    static wrapEffect(action: () => OptionalCleanup): () => OptionalCleanup {
        const sp = new this;
        return () => {
            const old = currentSP;
            currentSP = sp;
            try {
                const cb = action();
                if (typeof cb === "function") sp._push(cb);
            } catch (e) {
                sp.rollback();
                throw e;
            } finally {
                currentSP = old;
            }
            if (!sp.isEmpty) return sp.rollback;
        }
    }

    protected _next: DNode<Cleanup>;
    protected _prev: DNode<Cleanup>;
    protected _push(val: Cleanup) {
        let node = getnode(val, this._next, this as unknown as DNode<Cleanup>);
        if (this._next) this._next._prev = node;
        return this._next = node;
    }

    get isEmpty() { return !this._next; }

    rollback = () => {
        while (!this.isEmpty) try { freenode(this._next)?.(); } catch (e) { Promise.reject(e); }
    }

    add(...cleanups: OptionalCleanup[]): void;
    add() {
        for (var i = 0; i<arguments.length; i++) {
            var item = arguments[i];
            if (typeof item === "function") this._push(item);
        }
    };

    run<F extends PlainFunction>(fn?: F, ...args: Parameters<F>): ReturnType<F> {
        const old = currentSP; currentSP = this;
        try { return fn.apply(null, args); } catch (e) { this.rollback(); throw e; } finally { currentSP = old; }
    }

    subtask(stop?: Cleanup): SavePoint {
        return this.link(new savepoint, stop);
    }

    link(subtask: SavePoint, stop?: Cleanup) {
        stop ||= subtask.rollback;
        var node = this._push(() => { node = null; stop(); });
        subtask.add(() => { freenode(node); node = null; });
        return subtask;
    }
}


/** @deprecated - use `savepoint.active` instead @category Targeted for Removal */
export function canCleanup() { return savepoint.active; }

/** @deprecated - use `savepoint.add()` instead @category Targeted for Removal */
export function cleanup(...cleanups: OptionalCleanup[]) { savepoint.add(...cleanups); }

/** @deprecated - use `new savepoint(action).rollback` @category Targeted for Removal */
export function withCleanup(action: () => OptionalCleanup): Cleanup;
export function withCleanup(action: () => OptionalCleanup, optional: false): Cleanup;
export function withCleanup(action: () => OptionalCleanup, optional: true): OptionalCleanup;
export function withCleanup(action: () => OptionalCleanup, optional?: boolean): OptionalCleanup {
    return new savepoint(action).rollback;
}

var currentJob: Job<any>;

/** @category Targeted for Removal */
export type JobGenerator<T=void> = Generator<void,T,any>

/** @category Targeted for Removal */
export type Awaiting<T> = Generator<void, T, any>;

/**
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
export function job<R,T>(thisObj: T, fn: (this:T) => JobGenerator<R>): Job<R>
export function job<R>(fn: (this:void) => JobGenerator<R>): Job<R>
export function job(): Job<unknown> | undefined
export function job<R>(g: JobGenerator<R>): Job<R>
export function job<R>(
    g?: JobGenerator<R> | ((this:void) => JobGenerator<R>),
    fn?: () => JobGenerator<R>
): Job<R> {
    if (typeof fn === "function") return new _Job(fn.call(g));
    return g ? (new _Job(typeof g === "function" ? g() : g)) : currentJob;
}

/**
 * @deprecated Use `job(thisArg, function*(this) { ... })` instead.
 * @category Targeted for Removal
 */
export function spawn<T,R>(thisArg: T, gf: (this: T) => JobGenerator<R>): Job<R> {
    return job(thisArg, gf);
}

/** @category Targeted for Removal */
export interface Job<T> extends Promise<T> {
    next(v?: any): void;
    return(v?: T): void;
    throw(e: any): void;

    /** Run a cleanup function when the job ends */
    cleanup(f: Cleanup): void;
}

const IS_RUNNING = 1, IS_FINISHED = 2, IS_ERROR = 4 | IS_FINISHED, WAS_PROMISED = 8;

class _Job<T> implements Job<T> {

    // pretend to be a promise
    declare [Symbol.toStringTag]: string;

    constructor(protected g: JobGenerator<T>) {
        this.savepoint.add(() => {
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

    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> {
        return this.then(undefined, onrejected);
    }

    finally(onfinally?: () => void): Promise<T> { return this.then().finally(onfinally); }

    next(v?: any)   { if (this.g) this._step("next",   v); }
    return(v?: T)   { if (this.g) this._step("return", v); }
    throw(e: any)   { if (this.g) this._step("throw",  e); }


    cleanup(f: Cleanup) {
        // Already closed?  Defer it to run anyway
        if (!this.g) defer(f); else this.savepoint.add(f);
    }

    // === Internals === //

    protected readonly savepoint = savepoint.subtask(this.return.bind(this, undefined));
    protected _flags = IS_RUNNING;
    protected _result: any

    protected _step(method: "next" | "throw" | "return", arg: any) {
        // Don't resume a job while it's running
        if (this._flags & IS_RUNNING) return defer(this._step.bind(this, method, arg));
        const oldSP = currentSP;
        try {
            this._flags |= IS_RUNNING;
            currentJob = this;
            currentSP = this.savepoint;
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
            this.savepoint.rollback();
        } finally {
            currentJob = undefined;
            currentSP = oldSP;
            this._flags &= ~IS_RUNNING;
        }
    }
}


type DNode<T> = { _next: DNode<T>, _prev: DNode<T>, _data: T}

function getnode<T>(data: T, next: DNode<T>, prev: DNode<T>): DNode<T> {
    if (freelist) {
        let node = freelist;
        freelist = node._next;
        node._next = next;
        node._prev = prev;
        node._data = data;
        return node;
    }
    return {_next: next, _prev: prev, _data: data}
}

var freelist: DNode<any>;

function freenode<T>(node: DNode<T>): T {
    if (node) {
        let data = node._data;
        if (node._next) node._next._prev = node._prev;
        if (node._prev) node._prev._next = node._next;
        node._next = freelist;
        freelist = node;
        node._prev = node._data = undefined;
        return data;
    }
}
