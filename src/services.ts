import { obsidian as o } from "./obsidian";
import { Context, Useful, Key, Provides, use as _use } from "to-use";
import { defer } from "./defer";
export type * from "to-use";
export var app: o.App;

export const use = (use => {
    use.service = function service(service: o.Component) {
        use(Bootloader).addChild(service)
        return use.this;
    }
    use.plugin = function plugin(plugin: o.Plugin) {
        if (!rootCtx) {
            app = plugin.app;
            rootCtx = use.fork();
            // Register the plugin under its generic and concrete types
            rootCtx.set(o.Plugin, plugin);
            rootCtx.set(plugin.constructor, plugin);
            // ensure boot service loads and unloads with the (root) plugin
            plugin.addChild(rootCtx.use(Bootloader));
        } else if (plugin !== rootCtx.use(o.Plugin)) {
            throw new TypeError("use.plugin() called on multiple plugins");
        }
        return rootCtx;
    }
    use.def(o.Plugin, () => { throw new Error("Plugin not created yet"); });
    use.def(o.App, () => use(o.Plugin).app );
    return use;
})(_use)

let rootCtx: Context;

export function getContext(parent?: Partial<Useful>) {
    if (parent?.use) return parent.use;
    if (rootCtx) return rootCtx;
    if (parent instanceof o.Plugin) {
        return parent.use = use.plugin(parent);
    }
    throw new Error("No context available: did you forget to `use.plugin()`?");
}

export function the<K extends Key>(key: K, parent?: Partial<Useful>): Provides<K> {
    return getContext(parent)(key);
}

declare module "to-use" {
    interface GlobalContext {
        service(service: o.Component): Context
        plugin(plugin: o.Plugin): Context
    }
}

export class Service extends o.Component {
    use = use.service(this)
}

/** Service manager to ensure services load and unload with the plugin in an orderly manner */
class Bootloader extends o.Component { // not a service, so it doesn't end up depending on itself
    loaded: boolean;
    children: Set<o.Component> = new Set([this]);

    onload() { this.loaded = true; }
    onunload() { this.loaded = false; this.children.clear(); }

    addChild<T extends o.Component>(service: T): T {
        if (!this.children.has(service)) {
            this.children.add(service);
            if (this.loaded) {
                // De-zalgofy addChild() so component doesn't load() during service lookup/registration
                defer(() => super.addChild(service));
            } else {
                super.addChild(service);
            }
        }
        return service
    }
}

/** Remove a child component safely even if the parent is loading (unsafe in all Obsidians) or unloading (unsafe before 1.0) */
export function safeRemoveChild(parent: o.Component, child: o.Component) {
    defer(() => parent.removeChild(child));
}

export function onLoad(component: o.Component, callback: () => any) {
    const child = new o.Component();
    child.onload = () => { safeRemoveChild(component, child); component = null; callback(); }
    component.addChild(child);
}
