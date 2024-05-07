import { the, Service, use } from "./services";
import { obsidian as o } from "./obsidian";
import { Context, Useful } from "to-use";
import { savepoint } from "./cleanups";
import { setMap } from "./add-ons";
import { Component } from "obsidian";

/**
 * Return an opened resource of the requested type.
 *
 * You must invoke this with an active savepoint (i.e. in an effect, job, @rule,
 * etc.) so the resource can be released when you're done with it.
 *
 * @param kind The {@link SharedResource} subclass you want an instance of
 * @param key The specific resource to get; you can omit this if the resource subclass has a `void` key type.
 * @param parent Optional: a context to do the lookup in. (Defaults to the Plugin object if not given.)
 */
export function claim<T extends SharedResource<K>, K>(kind: o.Constructor<T>, key: K, parent?: Partial<Useful>): T
export function claim<T extends SharedResource<void>, K>(kind: o.Constructor<T>, key?: void, parent?: Partial<Useful>): T
export function claim<T extends SharedResource<K>, K>(kind: o.Constructor<T>, key: K, parent?: Partial<Useful>): T {
    return (the(kind, parent) as ResourceMap<T, K>).open(key);
}

/**
 * A shared, unloadable component, accessed by type + key
 *
 * A resource is a sharable component that only remains loaded as long as it is
 * claimed for use by other component(s).  Unlike a service, resources are
 * transient and unloaded when they aren't in active use.
 *
 * Shared resources are shared for a specific type and key, accessed via the
 * {@link claim} function, or via `use(ResourceClass).open(key)`.  The key type
 * can be any type a Map can use as a key, including void.
 *
 * When claimed or opened, resources have their `onload()` method called in a
 * savepoint, so they will be automatically released when the current job,
 * effect, or other savepoint is rolled back.
 *
 * The same resource can be claimed from more than one savepoint context, and
 * opens are tracked so that the shared resource instance will only be unloaded
 * once all the active claims are released. (That is, when all of the contexts
 * that opened the resource are cleaned up).
 */
export class SharedResource<K=string> extends Component {
    openCount = 0;

    constructor(public use: Context, public resourceKey: K) {
        super();
    }

    "use.factory"() {
        return new ResourceMap(this.constructor as ResourceFactory<this, K>);
    }
}

/**
 * A service that manages instances of a resource type.  An instance of this
 * is returned when you `use()` a {@link SharedResource} subclass, so you can
 * `open()` resources.
 */
export class ResourceMap<T extends SharedResource<K>, K> extends Service {
    pool = new Map<K, T>();

    constructor (
        public factory: ResourceFactory<T, K>,  // The class of thing to manage
    ) {
        super();
    }

    open(key: K) {
        const res = this.pool.get(key) || setMap(this.pool, key, new this.factory(this.use, key));
        ++res.openCount;
        savepoint.add(() => { if (!--res.openCount) { res.unload(); this.pool.delete(key); } });
        if (res.openCount === 1) res.register(new savepoint(() => res.load()).rollback);
        return res;
    }
}

/** The static interface of SharedResource Subclasses */
export type ResourceFactory<C extends SharedResource<K>, K> = {
    new (use: Context, resourceKey: K): C
}
