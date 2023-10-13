/**
 * Wrap preact signals to use @maverick-js/signals API style, w/always-async
 * side effects, nested effect() support, and aSignal()/aSignal.set(value) interface.
 */

export { untracked } from "@preact/signals-core";
import { computed as _computed, batch, signal as _signal, effect as _effect, Signal, untracked } from "@preact/signals-core";
import { addOn } from "./add-ons";
import { defer } from "./defer";

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

export function rule(_clsOrProto: object, _name: string, desc: {value?: () => unknown | (() => unknown)}): any {
    const method = desc.value;
    return {...desc, value() {
        if (childEffects) return effect(method.bind(this));
        throw new Error("Must be called from within another rule or effect");
    }}
}

// Support nested effects

var childEffects: Array<() => unknown>

export function effect(compute: () => unknown | (() => unknown)): () => void {
    const cb = _effect(function() {
        const old = childEffects;
        const fx = childEffects = [];
        try {
            const cb = compute.call(this);
            if (cb) fx.push(cb);
            if (fx.length) {
                return fx.length === 1 ? fx.pop() : function() {
                    while (fx.length) try { fx.shift()(); } catch (e) { Promise.reject(e); }
                }
            }
        } finally {
            childEffects = old;
        }
    });
    if (childEffects) childEffects.push(cb);
    return cb;
}

/**
 * Create an effect tied to a boolean condition
 *
 * This is similar to writing `effect(() => { if (condition()) return action(); })`,
 * except that the the action will not be rerun (or any compensators triggered)
 * if a value that's *part* of the condition changes (as opposed to the boolean
 * result of the condition).  This can be important for rules that nest other rules,
 * have compensators, fire off tasks, etc., as it may be wasteful to constantly
 * tear them down and set them back up if the condition itself remains stable.
 *
 * @param condition A function whose return value indicates whether
 * the action should be run.
 *
 * @param action An effect callback
 *
 * @returns a disposal callback for the created effect
 *
 */
export function when(condition: () => any, action: () => unknown | (() => unknown)) {
    var active = computed(() => !!condition());
    return effect(() => active() ? action() : undefined);
}
