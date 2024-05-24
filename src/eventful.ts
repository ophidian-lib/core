import { OptionalCleanup, Stream, cached, forEach, fromPromise, must, until as _until, to, Yielding, next, isJobActive, detached } from "uneventful";

/**
 * @deprecated Use `Stream` from uneventful.
 * @category Targeted for Removal
 */
export type Source<T> = Stream<T>;

/** @category Targeted for Removal */
export type Waitable<T> = (() => T) | Stream<T> | Promise<T> | PromiseLike<T>

/**
 * @deprecated - Use forEach() from uneventful (possibly w/fromPromise and if{})
 *
 * Subscribe a callback (in a cancelable way) to run whenever the given data
 * source provides a value.  A cancellation function is returned and also
 * registered in the current savepoint, if any.  The callback is run with
 * its own savepoint and can return a cleanup function.  The callback's
 * actions will be rolled back when the next value arrives, or the subscription
 * is canceled, or the data source has no more values (e.g. if it's a promise or
 * a finite event stream).
 *
 * @param source A {@link Waitable} data source, which can be any of:
 * - A signal, or a zero-argument function returning a value based on signals
 *   (In which case the callback will only be called for truthy values, and is
 *   run as an untracked action.)
 * - An uneventful Stream
 * - A promise, or promise-like object with a `.then()` method
 *
 * @param sink A callback that will receive values from the source.  The
 * callback is run with its own savepoint and can return a cleanup function.
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
 *
 * @category Targeted for Removal
 */
export function when<T>(source: Waitable<T>, sink: (value: T) => OptionalCleanup, onErr?: (e: any) => void): () => void {
    if (!isJobActive()) return detached.bind(when)(source, sink, onErr);
    if (isPromiseLike<T>(source)) {
        source = fromPromise(source)
    } else if (typeof source !== "function") {
        throw new TypeError("Not a source, signal, or promise");
    }
    const job = source.length ?
        forEach(source as Stream<T>, sink) :
        forEach(cached(source as () => T), v => v && must(sink(v)))
    ;
    if (onErr) job.onError(onErr);
    return job.end;
}

export function isPromiseLike<T>(obj: any): obj is PromiseLike<any> | Promise<T> {
    return obj && typeof (obj as PromiseLike<T>).then === "function";
}

/**
 * @deprecated use until(), next(), or to() from uneventful
 *
 * Wait for and return next value from a source (or error if stream source
 * closes).  Must be invoked using `yield *until()` within a Job.
 *
 * @param source A {@link Waitable} data source, which can be any of:
 * - A signal, or a zero-argument function returning a value based on signals
 *   (In which case the job will resume when the value is truthy - perhaps
 *   immediately!)
 * - An uneventful Stream
 * - A promise, or promise-like object with a `.then()` method
 *
 * @returns (after yield*) The triggered event, promise resolution, or signal
 * value.  An error is thrown if the promise rejects, or the event stream
 * closes or errors out before a new value is produced.
 *
 * @category Targeted for Removal
 */
export function until<T>(source: Waitable<T>): Yielding<T> {
    if (isPromiseLike<T>(source)) return to(source);
    if (typeof source === "function") {
        return source.length ? next(source as Stream<T>) : _until(source);
    } else {
        throw new TypeError("Not a source, signal, or promise");
    }
}
