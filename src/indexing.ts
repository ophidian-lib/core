import { setMap } from "./add-ons.ts";
import { obsidian as o } from "./obsidian.ts";
import { Component } from "obsidian";
import { use, app } from "./services.ts";
import { value } from "uneventful/signals";

// reuse/recycle sets and maps instead of constantly allocating new ones
// (we can do this because they're never directly exposed in the API, so we
// know when we can safely dispose of/resuse them.)
var freeSets = [] as Set<any>[], freeMaps = [] as Map<any,any>[];

var toAdd: Map<any,Set<any>>;

function recordEntry(k: any, v: any) {
    ((toAdd || (toAdd = freeMaps.pop() || new Map)).get(k) || setMap(toAdd, k, freeSets.pop() || new Set)).add(v);
}

/** @category Indexing */
export abstract class AbstactIndexer<T extends Record<string,any>, I extends object> extends Component {
    protected indices = new Map<keyof T, Map<any, Set<I>>>();
    protected version = value(0);
    protected history = new WeakMap<I,Map<keyof T,Set<any>>>();

    /**
     * Generate key-value pairs to be indexed for a given item
     *
     * IMPORTANT: your implementation of this function MUST be synchronous and
     * MUST NOT invoke methods of this or *any* index, or index corruption will result.
     * (It should also try to avoid creating objects, arrays, closures, etc.,
     * especially when parsing items that will not produce any index entries.)
     */
    abstract parse(item: I, add: <K extends keyof T>(k: K, v: T[K]) => void): void;

    /** Add an item to the index, or update it if already present */
    add(item: I) { this.process(item, this.parse); }

    /** Remove an item from the index */
    delete(item: I) { this.process(item, noparse); }

    /** Get number of values for a key, or number of items for a key+value */
    count<K extends keyof T>(key: K, val?: T[K]) {
        this.version();
        const idx = this.indices.get(key)
        return (arguments.length>1 ? idx?.get(val) : idx)?.size || 0;
    }

    /** Return the first item with a key of val (or undefined if none) */
    first<K extends keyof T>(key: K, val: T[K]): I | undefined {
        this.version();
        const vals = this.indices.get(key);
        if (!vals) return;
        const items = vals?.get(val);
        if (!items) return;
        for (const item of items) return item;
    }

    /** Iterate over items having a key with the matching value */
    items<K extends keyof T>(key: K, val: T[K]): Iterable<I>
    items<K extends keyof T>(key: K, val?: T[K]) {
        this.version();
        const vals = this.indices.get(key);
        if (!vals) return [];
        const items = vals?.get(val);
        if (!items) return [];
        if (items.size) return Array.from(items); // copy so stored set is recyclable
    }

    /** Iterate over [value, item] pairs for all values in a given key */
    entries<K extends keyof T>(key: K): Iterable<[T[K], I]>
    *entries<K extends keyof T>(key: K) {
        this.version();
        const index = this.indices.get(key);
        if (!index || !index.size) return;
        const pair: [T[K], I] = [null, null]
        for(const [v, items] of index) {
            pair[0] = v
            // copy set so stored set is recyclable
            for (pair[1] of Array.from(items)) yield pair;
        }
    }

    // Update indexes using a no-thrash algorithm, so that the underlying
    // sets and maps are not changed when an unchanged item is passed to
    // .add(), and so that no memory allocation is done when processing
    // items that don't have any index entries (which is typically most of them!).
    //
    private process(item: I, parser: typeof this.parse) {
        toAdd = undefined;
        parser.call(this, item, recordEntry);

        var toDelete = this.history.get(item);
        var {indices} = this;
        var changed = false;

        // Add new entries
        if (toAdd) {
            for (const [k, vals] of toAdd) {
                const idx = indices.get(k) || setMap(indices, k, freeMaps.pop() || new Map);
                const old = toDelete && toDelete.get(k);
                for (const v of vals) {
                    const items = (idx.get(v) || setMap(idx, v, freeSets.pop() || new Set));
                    if (!items.has(item)) {
                        items.add(item);
                        changed = true;
                    }
                    if (old) old.delete(v);
                }
            }
            this.history.set(item, toAdd);
            toAdd = undefined;
        } else this.history.delete(item);

        if (toDelete) {
            // Remove entries that don't apply any more
            for (const [k, vals] of toDelete) {
                const idx = indices.get(k);
                for (const v of vals) {
                    const items = idx.get(v)
                    if (items && items.has(item)) {
                        items.delete(item);
                        changed = true;
                        if (!items.size) {
                            idx.delete(v);
                            freeSets.push(items);
                        }
                    }
                }
                vals.clear();
                freeSets.push(vals);
            }
            toDelete.clear();
            freeMaps.push(toDelete);
        }
        // trigger rerun of queries using the current state
        if (changed) this.version.set(this.version()+1);
    }
}

/** @category Indexing */
export abstract class NoteMetaIndexer<T extends Record<string,any>> extends AbstactIndexer<T, o.TFile> {
    use = use.service(this);
    onload() {
        app.workspace.onLayoutReady(() => {
            const metaCache = app.metadataCache;
            (metaCache as any).getCachedFiles().forEach((filename: string) => {
                this.add(app.vault.getAbstractFileByPath(filename) as o.TFile)
            });
            this.registerEvent(metaCache.on("changed", this.add, this));
            this.registerEvent(app.vault.on("delete", this.delete, this));
            // XXX add a signal to notify of loaded status?
        });
    }
}

function noparse() {}