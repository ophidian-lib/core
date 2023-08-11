/**
 * Create a memoized "add-on" function that returns a cached result for a given Object
 * or function.  The memoization is done via WeakMap, so the cached values can be
 * freed automatically once the add-on's owner is garbage-collected.
 *
 * @param creator Function called with an object or function (key) and a weakmap to create a
 * result (value).  Its return value will be cached in the weakmap under the given key.
 * @returns A function that always returns the same value for a given key, calling the
 * creator function when a result isn't found in the cache.
 */
export function addOn<K extends Object,V>(creator: (key: K, map: WeakMap<K,V>) => V): (k: K) => V {
    var map = new WeakMap<K,V>();
    return (item: K) => {
        return map.has(item) ? map.get(item) : setMap(map, item, creator(item, map));
    }
}

/**
 * Set a value in a map/weakmap and return the value
 */
export function setMap<K,V>(map: {set(key: K, val: V): void}, key: K, val: V) {
    map.set(key as any, val);
    return val;
}
