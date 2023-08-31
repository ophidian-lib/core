/**
 * Wrap preact signals to use @maverick-js/signals API style, w/always-async
 * side effects, and aSignal()/aSignal.set(value) interface.
 */

export { effect, untracked } from "@preact/signals-core";
import { computed as _computed, batch, signal as _signal } from "@preact/signals-core";
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
        val = v; // cache update for immediate read
        schedule(() => s.value = val);  // schedule atomic update to run effects
    }
    return signal as Writable<T>
}

// Asynchronous updates
const batchedUpdates = [] as Array<() => void>;

var ticking = false, scheduled = false;

function schedule(t: () => void) {
    batchedUpdates.push(t);
    if (!ticking && !scheduled) {
        defer(tick);
        scheduled = true;
    }
}

export function tick() {
    if (!ticking) {
        ticking = true;
        batch(() => { while(batchedUpdates.length) try { batchedUpdates.shift()(); } catch(e) { Promise.reject(e); } });
        scheduled = ticking = false;
    }
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
