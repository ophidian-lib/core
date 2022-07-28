import { around, dedupe } from "monkey-around";
import { EventRef, Events, Workspace, WorkspaceItem } from "obsidian";
import { walkLayout } from "./walk";
import { defer } from "../defer";
import { Useful, Service } from "../services";

/** Plugins add entries to this interface to define their setting types */
export interface LayoutSettings { }

/** An object with layout-stored settings (Workspace, WorkspaceItem, etc.) */
interface HasLayoutSettings {
    [layoutProps]?: LayoutSettings
}

declare module "obsidian" {
    interface Workspace extends HasLayoutSettings {}
    interface WorkspaceItem extends HasLayoutSettings {}
}

/** Things that can have layout-stored settings  */
export type LayoutItem = WorkspaceItem | Workspace;

export class LayoutSetting<K extends keyof LayoutSettings, T extends LayoutItem> {

    store: LayoutStorage;

    constructor(ctx: Useful, public key: K, public defaultValue?: LayoutSettings[K], public owner?: T) {
        this.store = ctx.use(LayoutStorage);
    }

    of<T extends LayoutItem>(on: T) {
        return new LayoutSetting(this.store, this.key, this.defaultValue, on);
    }

    get(from: LayoutItem = this.owner): LayoutSettings[K] {
        return this.store.get(this.requires(from), this.key, this.defaultValue);
    }

    set(value: LayoutSettings[K], on: LayoutItem = this.owner) {
        this.store.set(this.requires(on), this.key, value);
    }

    unset(on: LayoutItem = this.owner) {
        this.store.unset(this.requires(on), this.key);
    }

    requires(on: LayoutItem) {
        if (on && (on instanceof Workspace || on instanceof WorkspaceItem)) return on;
        throw new TypeError("Setting method requires a workspace or workspace item")
    }

    onSet(callback: (
        on: LayoutItem, value?: LayoutSettings[K], old?: LayoutSettings[K]) => any, ctx?: any
    ): EventRef {
        if (this.owner) return this.store.onSet(this.key, (on, val, old) => {
            if (on === this.owner) callback.call(ctx, val, old);
        });
        return this.store.onSet(this.key, callback, ctx);
    }

    onLoadWorkspace(callback: () => any, ctx?: any): EventRef {
        return this.store.onLoadWorkspace(callback, ctx);
    }

    offref(ref: EventRef) {
        this.store.offref(ref);
    }
}


export class LayoutStorage extends Service {

    get<K extends keyof LayoutSettings>(from: LayoutItem, key: K, defaultValue?: LayoutSettings[K]): LayoutSettings[K] {
        return from?.[layoutProps]?.[key] ?? defaultValue;
    }

    set<K extends keyof LayoutSettings>(on: LayoutItem, key: K, value?: LayoutSettings[K]) {
        const props = on[layoutProps] || (on[layoutProps] = {} as LayoutSettings), old = props[key];
        props[key] = value;
        if (!this.loading && old !== value) {
            app.workspace.trigger(setEvent+key, on, value, old);
            app.workspace.requestSaveLayout();
        }
    }

    unset<K extends keyof LayoutSettings>(on: LayoutItem, key: K) {
        const props = on[layoutProps];
        if (props?.hasOwnProperty(key)) {
            delete props[key];
            if (!this.loading) {
                app.workspace.requestSaveLayout();
            }
        }
    }

    onSet<K extends keyof LayoutSettings>(
        key: K,
        callback: (on: LayoutItem, value?: LayoutSettings[K], old?: LayoutSettings[K]) => any,
        ctx?: any,
    ): EventRef {
        return (app.workspace as Events).on(setEvent+key, callback, ctx);
    }

    onLoadItem(callback: (on: LayoutItem, state: any) => any, ctx?: any): EventRef {
        if (!this.loading && app.workspace.layoutReady) {
            // A workspace is already loaded; trigger events as microtask
            defer(() => {
                walkLayout(item => {
                    try { callback.call(ctx); } catch (e) { console.error(e); }
                })
            });
        }
        return (app.workspace as Events).on(loadEvent, callback, ctx);
    }

    onSaveItem(callback: (on: LayoutItem, state: any) => any, ctx?: any): EventRef {
        return (app.workspace as Events).on(saveEvent, callback, ctx);
    }

    onLoadWorkspace(callback: () => any, ctx?: any): EventRef {
        if (!this.loading && app.workspace.layoutReady) {
            // A workspace is already loaded; trigger event as microtask
            defer(() => {
                try { callback.call(ctx); } catch (e) { console.error(e); }
            });
        }
        return (app.workspace as Events).on(loadEvent+":workspace", callback, ctx);
    }

    offref(ref: EventRef) {
        app.workspace.offref(ref);
    }

    loading = false;

    onload() {
        const events = app.workspace as Events;

        // We have to use the events because another plugin's instance of this service
        // might be handling the monkeypatches and triggering the events, but *all* instances
        // of this service need to know whether they're loading -- i.e., the flag can't be
        // safely set directly within the monkeypatching.
        //
        this.registerEvent(events.on(loadEvent+":start",     () => this.loading = true));
        this.registerEvent(events.on(loadEvent+":workspace", () => this.loading = false));

        // Save settings as each item is serialized
        this.register(around(WorkspaceItem.prototype, {serialize: serializeSettings}));

        this.register(around(app.workspace, {
            // Save settings with workspace layout serialization
            getLayout: serializeSettings,

            // Load workspace settings as workspace is loading
            setLayout(old) {
                return dedupe(STORAGE_EVENTS, old, async function setLayout(this: Workspace, layout: any, ...etc) {
                    events.trigger(loadEvent+":start");
                    try {
                        loadSettings(this, layout);
                        return await old.call(this, layout, ...etc);
                    } finally {
                        events.trigger(loadEvent+":workspace");
                    }
                });
            },

            // Load settings after loading each leaf
            deserializeLayout(old) {
                return dedupe(STORAGE_EVENTS, old,
                    async function deserializeLayout(state: any, ...etc){
                        const result = await old.call(this, state, ...etc);
                        loadSettings(result, state);
                        return result;
                    }
                );
            }
        }));
    }
}

export function cloneValue(ob: any) { return (ob && typeof ob === "object") ? JSON.parse(JSON.stringify(ob)) : ob; }

const revision = 2;
const STORAGE_EVENTS = Symbol.for(`v${revision}.layout-storage-events.ophidian.peak-dev.org`);
const layoutProps = "ophidian:layout-settings";
const loadEvent   = `ophidian-layout-storage:v${revision}:item-load`;
const saveEvent   = `ophidian-layout-storage:v${revision}:item-save`;
const setEvent    = `ophidian-layout-storage:set:`;

function serializeSettings(old: () => any) {
    return dedupe(STORAGE_EVENTS, old, function serialize(){
        const state = old.call(this);
        app.workspace.trigger(saveEvent, this, state);
        if (this[layoutProps]) state[layoutProps] = cloneValue(this[layoutProps]);
        return state;
    });
}

function loadSettings(where: HasLayoutSettings, state: any) {
    if (!where) return;
    const props: LayoutSettings = state?.[layoutProps];
    if (props) where[layoutProps] = cloneValue(props);
    app.workspace.trigger(loadEvent, where, state);
}


declare module "obsidian" {
    interface WorkspaceItem {
        serialize(): any;
    }
    interface Workspace {
        setLayout(layout: any): void;
        deserializeLayout(state: any, ...etc: any[]): Promise<WorkspaceItem>;
    }
}
