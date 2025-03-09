/**
 * Wrap uneventful signals API to match the old ophidian API, plus some (experimental) decorators
 */

import { addOn } from "./add-ons.ts";
import { rule as _rule, peek, Signal, cached, value,runRules, Configurable, action as _action, GenericMethodDecorator } from "uneventful/signals";
import { isJobActive, OptionalCleanup } from "uneventful"

/**
 * @deprecated Use Signal from uneventful/signals
 * @category Targeted for Removal
 */
export type Value<T> = Signal<T>;

/**
 * @deprecated Use Configurable from uneventful/signals
 * @category Targeted for Removal
 */
export type Writable<T> = Configurable<T>;

/**
 * @deprecated Use cached from uneventful/signals
 * @function
 * @category Targeted for Removal
 */
export const computed = cached;

/**
 * @deprecated Use value from uneventful/signals
 * @function
 * @category Targeted for Removal
 */
export const signal = value;

/**
 * @deprecated Use runRules from uneventful/signals
 * @function
 * @category Targeted for Removal
 */
export const tick = runRules;

/**
 * @deprecated Use peek() from uneventful/signals
 * @function
 * @category Targeted for Removal
 */
export const untracked = peek;

type Signals<T> = Partial<{[K in keyof T]: Configurable<T[K]>}>
type Computed<T> = Partial<{[K in keyof T]: Signal<T[K]>}>

/** @function @category Targeted for Removal */
export const signals = /* @__PURE__ */ addOn(function<T extends object>(_k: T): Signals<T> { return {} });

// Must be used *without* accessor and *with* useDefineForClassFields: false
/** @category Targeted for Removal */
export function prop<T>(_clsOrProto: object, name: string) {
    return {
        enumerable: true,
        configurable: true,
        get() { return (signals(this)[name] ??= signal<T>(undefined))(); },
        set(val: T) {
            (signals(this)[name] ??= signal<T>(undefined)).set(val);
        }
    } as any;
}

/** @category Targeted for Removal */
export function calc<T>(_clsOrProto: object, name: string, desc: {get?: () => T}) {
    const method = desc.get;
    return { ...desc, get(): T {
        return (
            (signals(this) as Computed<T>)[name] ??= computed<T>(method.bind(this))
        )();
    }};
}

/**
 * @deprecated Use `@rule.method` from uneventful/signals
 *
 * Decorator to make a method into a child effect
 *
 * This is equivalent to wrapping the method body with `return effect(() => {...}, false);`,
 * which means the method can only be called from within a running `effect()`, `@rule`, or
 * other active job.
 *
 * @function
 * @category Targeted for Removal
 */
export const rule: GenericMethodDecorator<((...args: any[]) => OptionalCleanup)> = _rule.method;

/**
 * @deprecated Use `@action` from uneventful/signals
 *
 * Decorator to make a method perform an action without creating dependencies for
 * any currently-running effects
 *
 * This is shorthand for wrapping the method body in `return untracked(() => {...})`.
 *
 * @function
 * @category Targeted for Removal
 */
export const action = _action;

/**
 * @deprecated Use rule(fn) from uneventful/signals.  (For "standalone" rules, use `rule.root(fn)`.)
 *
 * Register a callback that will run repeatedly in response to changes
 *
 * @param action The function to run: it will be invoked once immediately
 * (before `effect()` returns), and then re-run each time any of the signals it
 * used (in its previous run) change.  It can optionally return a "cleanup"
 * function that will be run before the next invocation of the compute function,
 * or when the effect is stopped.  (It can also use the `savepoint.add()` API to
 * register multiple cleanups, and any nested `effect()` calls will be added to
 * the savepoint as well.)
 *
 * @param standalone If set to `true`, the effect will not be made a child of
 * any currently-running effect, which means you must call the returned "stop"
 * callback to explicitly stop the effect.  If set to `false`, the effect is
 * explicitly intended as a child effect, and so there *must* be a currently-
 * running effect (or other active savepoint), or else an error will be thrown.
 * Any value other than true (or omitting it) means the effect can be used
 * either standalone, or inside another `effect()` or active savepoint.
 *
 * @returns A callback to stop the effect from re-running.  You do not need to
 * invoke it for effects that are started by another (running) effect, as they
 * will automatically be cleaned up when the parent effect is re-run or
 * canceled.
 *
 * @category Targeted for Removal
 */
export function effect(action: () => OptionalCleanup, standalone?: boolean): () => void {
    if (standalone !== false) {
        if (standalone === true || !isJobActive()) return _rule.root(action);
    }
    return _rule(action);
}

/**
 * @deprecated use rule.if from uneventful/signals, or `root.run(() => rule.if(cond, action))` for
 * a "standalone" whenTrue.
 *
 * Create an effect tied to a boolean condition
 *
 * This is similar to writing `effect(() => { if (condition()) return action(); })`,
 * except that the the action will not be rerun (or any cleanup functions triggered)
 * if a value that's *part* of the condition changes (as opposed to the boolean
 * result of the condition).  This can be important for rules that nest other rules,
 * have cleanups, fire off tasks, etc., as it may be wasteful to constantly
 * tear them down and set them back up if the condition itself remains stable.
 *
 * @param condition A function whose return value indicates whether
 * the action should be run.
 *
 * @param action An effect callback
 *
 * @param standalone Same as the standalone parameter of {@link effect}
 *
 * @returns a disposal callback for the created effect
 *
 * @category Targeted for Removal
 */
export function whenTrue(condition: () => any, action: () => OptionalCleanup, standalone?: boolean) {
    var active = cached(() => !!condition());
    return effect(() => active() ? action() : undefined, standalone);
}
