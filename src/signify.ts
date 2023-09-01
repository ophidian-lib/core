/**
 * Wrap preact signals to use @maverick-js/signals API style, w/always-async
 * side effects, and aSignal()/aSignal.set(value) interface.
 */

export { effect, untracked } from "@preact/signals-core";
import { computed as _computed, batch, signal as _signal, Signal } from "@preact/signals-core";
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

const signals = addOn(function<T extends object>(_k: T): Signals<T> { return {} });

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
