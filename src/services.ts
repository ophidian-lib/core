import { Component, Plugin } from "./obsidian";
import { Context, Useful, use } from "to-use";
import { defer } from "./defer";
export * from "to-use";

use.def(Plugin, () => { throw new Error("Plugin not created yet"); });

let rootCtx: Context;

export function getContext(parent: Partial<Useful>) {
    if (parent?.use) return parent.use;
    if (rootCtx) return rootCtx;
    if (parent instanceof Plugin) {
        return parent.use = use.plugin(parent);
    }
    throw new Error("No context available: did you forget to `use.plugin()`?");
}

declare module "to-use" {
    interface GlobalContext {
        service(service: Component): Context
        plugin(plugin: Plugin): Context
    }
}

export class Service extends Component {
    use = use.service(this)
}

use.service = function service(service: Component) {
    use(Bootloader).addChild(service)
    return use.this;
}

use.plugin = function plugin(plugin: Plugin) {
    if (!rootCtx) {
        rootCtx = use.fork();
        // Register the plugin under its generic and concrete types
        rootCtx.set(Plugin, plugin);
        rootCtx.set(plugin.constructor, plugin);
        // ensure boot service loads and unloads with the (root) plugin
        plugin.addChild(rootCtx.use(Bootloader));
    } else if (plugin !== rootCtx.use(Plugin)) {
        throw new TypeError("use.plugin() called on multiple plugins");
    }
    return rootCtx;
}

/** Service manager to ensure services load and unload with the plugin in an orderly manner */
class Bootloader extends Component { // not a service, so it doesn't end up depending on itself
    loaded: boolean;
    children: Set<Component> = new Set([this]);

    onload() { this.loaded = true; }
    onunload() { this.loaded = false; this.children.clear(); }

    addChild<T extends Component>(service: T): T {
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
export function safeRemoveChild(parent: Component, child: Component) {
    defer(() => parent.removeChild(child));
}

export function onLoad(component: Component, callback: () => any) {
    const child = new Component();
    child.onload = () => { safeRemoveChild(component, child); component = null; callback(); }
    component.addChild(child);
}
