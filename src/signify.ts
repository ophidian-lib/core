/**
 * Wrap preact signals to use @maverick-js/signals API style, w/always-async
 * side effects, nested effect() support, and aSignal()/aSignal.set(value) interface.
 */

export { untracked } from "@preact/signals-core";
import { computed as _computed, batch, signal as _signal, effect as _effect, Signal, untracked } from "@preact/signals-core";
import { addOn } from "./add-ons";
import { defer } from "./defer";
import { OptionalCleanup, savepoint } from "./cleanups";

export interface Value<T> { (): T; }
export interface Writable<T> extends Value<T> { set(v: T): void; }

export function computed<T>(fn: () => T): Value<T> {
    const c = _computed(fn);
    return () => c.value;
}

export function signal<T>(val?: T) {
    const s = _signal(val);
    function signal() { s.value; return val; }
    (signal as Writable<T>).set = function(v: T) {
        if (val === v) return;  // ignore no-op sets
        if (!toUpdate.size) defer(tick); // schedule atomic update to run effects
        toUpdate.set(s, val = v); // cache update for immediate read
    }
    return signal as Writable<T>
}

// Asynchronous updates
const toUpdate = new Map<Signal<any>, any>();

export function tick() {
    if (!toUpdate.size) return;
    batch(() => {
        for (const [s, v] of toUpdate.entries()) {
            toUpdate.delete(s);
            s.value = v;
        }
    });
}


type Signals<T> = Partial<{[K in keyof T]: Writable<T[K]>}>
type Computed<T> = Partial<{[K in keyof T]: Value<T[K]>}>

export const signals = addOn(function<T extends object>(_k: T): Signals<T> { return {} });

// Must be used *without* accessor and *with* useDefineForClassFields: false
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

export function calc<T>(_clsOrProto: object, name: string, desc: {get?: () => T}) {
    const method = desc.get;
    return { ...desc, get(): T {
        return (
            (signals(this) as Computed<T>)[name] ??= computed<T>(method.bind(this))
        )();
    }};
}

/**
 * Decorator to make a method into a child effect
 *
 * This is equivalent to wrapping the method body with `return effect(() => {...}, false);`,
 * which means the method can only be called from within a running `effect()`, `@rule`, or
 * `withCleanup()`.
 */
export function rule(_clsOrProto: object, _name: string, desc: {value?: () => unknown | (() => unknown)}): any {
    const method = desc.value;
    return {...desc, value() { return effect(method.bind(this), false);}}
}

/**
 * Decorator to make a method perform an action without creating dependencies for
 * any currently-running effects
 *
 * This is shorthand for wrapping the method body in `return untracked(() => {...})`.
 */
export function action(_clsOrProto: object, _name: string, desc: {value?: (...args: any[]) => any}): any {
    const method = desc.value;
    return {...desc, value(...args) { return untracked(method.bind(this, ...args)); }};
}

/**
 * Register a callback that will run repeatedly in response to changes
 *
 * @param action The function to run: it will be invoked once immediately
 * (before `effect()` returns), and then re-run each time any of the signals it
 * used (in its previous run) change.  It can optionally return a "cleanup"
 * function that will be run before the next invocation of the compute function,
 * or when the effect is stopped.  (It can also use the `cleanup()` API to
 * register multiple cleanups, and any nested `effect()` calls will be added to
 * the cleanup list as well.)
 *
 * @param standalone If set to `true`, the effect will not be made a child of
 * any currently-running effect, which means you must call the returned "stop"
 * callback to explicitly stop the effect.  If set to `false`, the effect is
 * explicitly intended as a child effect, and so there *must* be a currently-
 * running effect (or `withCleanup()` block), or else an error will be thrown.
 * Any value other than true (or omitting it) means the effect can be used
 * either standalone, or inside another `effect()` or `withCleanup()` block.
 *
 * @returns A callback to stop the effect from re-running.  You do not need to
 * invoke it for effects that are started by another (running) effect, as they
 * will automatically be cleaned up when the parent effect is re-run or
 * canceled.
 */
export function effect(action: () => OptionalCleanup, standalone?: boolean): () => void {
    const haveContext = savepoint.active;
    if (standalone === false && !haveContext) throw new Error(
        "Must be called from within another effect or @rule"
    );
    const cb = _effect(savepoint.wrapEffect(action));
    if (haveContext && standalone !== true) savepoint.add(cb);
    return cb;
}

/**
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
 */
export function whenTrue(condition: () => any, action: () => OptionalCleanup, standalone?: boolean) {
    var active = computed(() => !!condition());
    return effect(() => active() ? action() : undefined, standalone);
}
