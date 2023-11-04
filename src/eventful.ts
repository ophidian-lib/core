import { Awaiting, OptionalCleanup, cleanup, Job, withCleanup, job } from "./cleanups";
import { computed, effect, untracked } from "./signify";
import type { Source, SignalKind, TalkbackKind as Upstream } from "wonka";
export type { Source } from "wonka";

type UpstreamFn = (signal: Upstream) => void;

declare module "wonka" {
    enum SignalKind { Start = 0, Push = 1, End = 0 }
    enum TalkbackKind { Pull = 0, Close = 1 }
}

const Pull = 0 as Upstream.Pull, Close = 1 as Upstream.Close, Start = 0 as SignalKind.Start, End = 0 as SignalKind.End;

export type Waitable<T> = (() => T) | Source<T> | Promise<T> | PromiseLike<T>

/**
 * Subscribe a callback (in a cancelable way) to run whenever the given data
 * source provides a value.  A cancellation function is returned and also
 * registered in the current cleanup context, if any.  The callback is run in
 * its own cleanup context and can return a cleanup function.  The callback's
 * actions will be cleaned up when the next value arrives, or the subscription
 * is canceled, or the data source has no more values (e.g. if it's a promise or
 * a finite event stream).
 *
 * @param source A {@link Waitable} data source, which can be any of:
 * - A signal, or a zero-argument function returning a value based on signals
 *   (In which case the callback will only be called for truthy values, and is
 *   run as an untracked action.)
 * - A wonka event source
 * - A promise, or promise-like object with a `.then()` method
 *
 * @param sink A callback that will receive values from the source.  The
 * callback is run in its own cleanup context and can return a cleanup function.
 * Cleanups will be called when the next value is produced, there are no more
 * values, or the subscription is canceled.
 *
 * (Note: *the callback may be run immediately* if the source is a synchronous
 * event or an already-truthy signal!)
 *
 * @param onErr An optional callback for data sources that can transmit in-band
 * errors (Promises and generators).  If the source rejects or throws rather
 * than providing a value, and this callback is supplied, it is invoked with the
 * error.  If this callback is not provided, the error will go unhandled or
 * become an unhandled promise rejection.
 */
export function when<T>(source: Waitable<T>, sink: (value: T) => OptionalCleanup, onErr?: (e: any) => void): () => void {
    var cleanupFn: OptionalCleanup;
    var ended = false;
    var upstream: UpstreamFn;
    if (isPromiseLike<T>(source)) {
        const sendFinal = <T>(fn: (v: T) => any) => (val: T) => {
            if (ended || !fn) return;
            cleanupFn = withCleanup(fn.bind(null, val), true);
            doCleanup();
        }
        cleanup(unsub);
        (source as PromiseLike<T>).then(sendFinal(sink), sendFinal(onErr));
        return unsub;
    } else if (typeof source !== "function") {
        throw new TypeError("Not a source, signal, or promise");
    } else if (!source.length) {
        const cond = computed(source as () => T)
        return effect(() => {
            var res: T;
            if (res = cond()) return untracked(
                withCleanup.bind(null, sink.bind(null, res), true)
            );
        })
    }
    cleanup(unsub);
    (source as Source<T>)(signal => {
        if (signal === End) {
            upstream = undefined;
            unsub();
        } else if (signal.tag === Start) {
            (upstream = signal[0])(Pull);
        } else if (!ended) {
            doCleanup();
            cleanupFn = withCleanup(sink.bind(null, signal[0]), true);
            if (upstream) upstream(Pull);
        }
    });
    return unsub;
    function doCleanup() { cleanupFn && cleanupFn(); cleanupFn = undefined; }
    function unsub() {
        if (!ended) {
            doCleanup();
            ended = true;
            if (upstream) upstream(Close);
        }
    }
}

export function isPromiseLike<T>(obj: any): obj is PromiseLike<any> | Promise<T> {
    return obj && typeof (obj as PromiseLike<T>).then === "function";
}

/**
 * Wait for and return next value from a source (or error if stream source
 * closes).  Must be invoked using `yield *until()` within a {@link Job}.
 *
 * @param source A {@link Waitable} data source, which can be any of:
 * - A signal, or a zero-argument function returning a value based on signals
 *   (In which case the job will resume when the value is truthy - perhaps
 *   immediately!)
 * - A wonka event source
 * - A promise, or promise-like object with a `.then()` method
 *
 * @returns The triggered event, promise resolution, or signal value.  An error
 * is thrown if the promise rejects or the event stream is closed.
 */
export function *until<T>(source: Waitable<T>): Awaiting<T> {
    var self = job(), upstream: UpstreamFn, close: () => void;
    if (isPromiseLike<T>(source)) {
        (source as PromiseLike<T>).then(v => self?.next(v), e => self?.throw(e));
    } else if (typeof source === "function") {
        if (!source.length) {
            var cond = computed(source as () => T), res = untracked(cond);
            if (res) return res; else close = effect(() => {
                if (self && (res = cond())) self.next(res);
            });
        } else {
            close = function () { self = null; if (upstream) upstream(Close); upstream = null; }
            source(signal => {
                if (signal === End) {
                    self?.throw(new Error("Stream ended"));
                    close();
                } else if (signal.tag === Start) {
                    (upstream = signal[0])(Pull);
                } else {
                    self?.next(signal[0]);
                    close();
                }
            });
        }
    } else {
        throw new TypeError("Not a source, signal, or promise");
    }
    try { return yield; } finally { self = undefined; close && close(); }
}
