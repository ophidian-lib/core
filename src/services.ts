import { obsidian as o } from "./obsidian.ts";
import { Context, Useful, Key, Provides, use as _use } from "to-use";
import { defer } from "./defer.ts";
import { Component } from "obsidian";
import { Job, SyncStart, Yielding, noop, root } from "uneventful";
import { GeneratorBase, isFunction } from "uneventful/utils";
export type * from "to-use";
export var app: o.App;

/** @category Components and Services */
export const use = /* @__PURE__ */ (use => {
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
            // Ensure the plugin ends the root job on unload
            plugin.register(() => defer(root.end))
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

/**
 * Get a `use()` context to look things up with.
 *
 * @param parent If supplied, it's checked for a `.use()` method.  Otherwise the
 * plugin's default context will be returned if available, or an error will be
 * thrown if it's not.
 *
 * @category Components and Services
 */
export function getContext(parent?: Partial<Useful>) {
    if (parent?.use) return parent.use;
    if (rootCtx) return rootCtx;
    if (parent instanceof o.Plugin) {
        return parent.use = use.plugin(parent);
    }
    throw new Error("No context available: did you forget to `use.plugin()`?");
}

/**
 * Get "the" instance of a class (i.e., look it up via a {@link Useful}
 * context). (Shorthand for `getContext(parent)(key)`)
 *
 * @category Components and Services
 */
export function the<K extends Key>(key: K, parent?: Partial<Useful>): Provides<K> {
    return getContext(parent)(key);
}

/** @category Components and Services */
export class Service extends Component {
    use = use.service(this)
}

/**
 * Service manager to ensure services load and unload with the plugin in an
 * orderly manner
 *
 * @category Components and Services
 */
class Bootloader extends Component { // not a service, so it doesn't end up depending on itself
    loaded: boolean;
    children: Set<o.Component> = new Set([this]);

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

/**
 * Remove a child component safely even if the parent is loading (unsafe in all
 * Obsidians) or unloading (unsafe before 1.0)
 *
 * @category Components and Services
 */
export function safeRemoveChild(parent: o.Component, child: o.Component) {
    defer(() => parent.removeChild(child));
}

/**
 * Invoke a callback when a given component loads.
 *
 * (Note: If the component is already loaded, the callback will be run before the
 * call to this function returns.)
 *
 * @category Components and Services
 */
export function onLoad(component: o.Component, callback: () => any) {
    const child = new o.Component();
    child.onload = () => { safeRemoveChild(component, child); component = null; callback(); }
    component.addChild(child);
}

/**
 * Decorate an `onload()` method to run in a job attached to the component.
 *
 * Most Uneventful APIs require an active job, but when Obsidian loads
 * components there usually isn't one active.  This decorator lets you make your
 * `onload()` method automatically run in a job attached to the component, so
 * you don't have to manually deal with any of that.
 *
 * Just add `@register` before the method definition (assuming your build has
 * either legacy or TC39 decorators enabled), and then you can use rule,
 * forEach, start, must, connect, etc. in the method without any other setup,
 * and the matching cleanups will run when the component unloads.
 *
 * Note: the `onload()` method can be a generator if you want it to run
 * asynchronously; this decorator will wrap it so it suspends on completion
 * rather than undoing everything it just did.  Just use `@register *onload()
 * {}` instead of `@register onload() {}`.
 *
 * @category Components and Services
 */
export function register<T extends Component, M extends OnloadMethod<T>>(fn: M, ctx: OnloadDecoratorContext): M;

/** @hidden Legacy Decorator protocol */
export function register<T extends Component, D extends OnloadDescriptor<T>>(
    clsOrProto: any, name: "onload", desc: D
): D

export function register<T extends Component, D extends OnloadDescriptor<T>>(
    fn: OnloadMethod<T>, _ctx?: any, desc?: D
): D | OnloadMethod<T> {
    function decorated() {
        const start = isGeneratorFunction(fn) ?
            function*(this: T, job: Job<never>) {
                yield *((fn as OnloadGenerator<T>).call(this, job));
                yield noop;
            } :
            fn
        ;
        this.register(root.start(this, start).end);
    }
    return desc ? (fn = desc.value, {...desc, value: decorated}) : decorated;
}

type OnloadMethod<T extends Component> = SyncStart<never, T> | OnloadGenerator<T>
type OnloadGenerator<T extends Component> = (this: T, job: Job<never>) => Yielding<void>
type OnloadDecoratorContext = {kind: "method", name: "onload"}
type OnloadDescriptor<T extends Component> = {value?: OnloadMethod<T>}

function isGeneratorFunction<G extends Generator<any,any,any>=Generator>(fn: any): fn is (this: any, ...args: any[]) => G {
    return isFunction(fn) && fn.prototype instanceof GeneratorBase
}
