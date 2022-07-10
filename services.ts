import { Component, Plugin } from "obsidian";
import { use } from "to-use";
export * from "to-use";

use.def(Plugin, () => { throw new Error("Plugin not created yet"); });

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
    // Register the plugin under its generic and concrete types
    const ctx = use.fork()
        .set(Plugin, plugin)
        .set(plugin.constructor, plugin)
    ;
    // ensure boot service loads and unloads with the plugin
    plugin.addChild(ctx.use(Bootloader))
    return ctx;
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
                Promise.resolve().then(() => super.addChild(service));
            } else {
                super.addChild(service);
            }
        }
        return service
    }
}
