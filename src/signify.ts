/**
 * Wrap preact signals to use @maverick-js/signals API style, w/always-async
 * side effects, nested effect() support, and aSignal()/aSignal.set(value) interface.
 */

export { untracked } from "@preact/signals-core";
import { computed as _computed, batch, signal as _signal, effect as _effect, Signal } from "@preact/signals-core";
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
 * Create a group of effects tied to a condition.
 *
 * @param cond A function whose return value indicates whether
 * the effects should be enabled.
 *
 * @param bind Optional: an object to bind effect callbacks to
 *
 * @returns A function that can be called with an effect callback to
 * add it to the group (returning a remove function for removing it
 * from the group), or with no arguments to dispose of the entire group.
 */
export function when(cond: () => any, bind?: any) {
    var fns = signal([] as Array<() => unknown|(() => unknown)>);
    var active = computed(() => !!cond());
    var stop = effect(() => { if (active()) fns().forEach(effect); });
    return function (fn?: () => unknown|(() => unknown)) {
        if (arguments.length) {
            if (bind) fn = fn.bind(bind);
            fns.set([...fns(), fn]);
            return function() { fns.set(fns().filter(f => f !== fn)); }
        } else {
            stop?.();
            fns = stop = bind = cond = undefined;
        }
    }
}
