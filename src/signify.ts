export * from "@preact/signals-core";
import { Signal, computed, signal } from "@preact/signals-core";
import { addOn } from "./add-ons";

type Signals<T> = Partial<{[K in keyof T]: Signal<T[K]>}>

// Must be used *without* accessor and *with* useDefineForClassFields: false
export function prop<T>(_clsOrProto: object, name: string) {
    return {
        enumerable: true,
        configurable: true,
        get() { return (signals(this)[name] ??= signal<T>(undefined)).value; },
        set(val: T) { (signals(this)[name] ??= signal<T>(undefined)).value = val; }
    } as any;
}

export function calc<T>(_clsOrProto: object, name: string, desc: {get?: () => T}) {
    const method = desc.get;
    return { ...desc, get(): T {
        return (signals(this)[name] ??= computed<T>(method.bind(this))).value;
    }};
}

export const signals = addOn(function<T extends object>(_k: T): Signals<T> {
    return {}
});
