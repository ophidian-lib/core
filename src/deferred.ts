/** @category Targeted for Removal */
export interface Deferred<T> {
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
    promise: Promise<T>
}

/** @category Targeted for Removal */
export function deferred<T>(): Deferred<T> {
    let resolve: Deferred<T>["resolve"];
    let reject: Deferred<T>["reject"];
    let promise: Promise<T> = new Promise((res, rej) => { resolve = res, reject = rej; });
    return {resolve, reject, promise}
}
