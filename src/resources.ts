import { the, Service } from "./services.ts";
import { obsidian as o } from "./obsidian.ts";
import { Context, Useful } from "to-use";
import { setMap } from "./add-ons.ts";
import { Component } from "obsidian";
import { must, root } from "uneventful";

/**
 * Return an opened resource of the requested type.
 *
 * You must invoke this with an active job so the resource can be released when
 * you're done with it.
 *
 * @param kind The {@link SharedResource} subclass you want an instance of
 * @param key The specific resource to get; you can omit this if the resource
 * subclass has a `void` key type.
 * @param parent Optional: a context to do the lookup in. (Defaults to the
 * Plugin object if not given.)
 *
 * @category Resource Management
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
 * job, so they will be automatically released when it ends or restarts.
 *
 * The same resource can be claimed from more than one job, and opens are
 * tracked so that the shared resource instance will only be unloaded once all
 * the active claims are released. (That is, when all of the jobs that opened
 * the resource are ended or restarted).
 *
 * @category Resource Management
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
 *
 * @category Resource Management
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
        must(() => { if (!--res.openCount) { res.unload(); this.pool.delete(key); } });
        if (res.openCount === 1) res.register(root.start(() => res.load()).end);
        return res;
    }

    onunload(): void {
        this.pool.forEach(res => res.unload())
    }
}

/**
 * The static interface of SharedResource Subclasses
 *
 * @category Resource Management
 */
export type ResourceFactory<C extends SharedResource<K>, K> = {
    new (use: Context, resourceKey: K): C
}
