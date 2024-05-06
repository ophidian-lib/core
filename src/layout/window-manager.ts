import { obsidian as o } from "../obsidian";
import { Context, Service, onLoad, safeRemoveChild, use } from "../services";
import { defer } from "../defer";
import { around } from "monkey-around";
import { isLeafAttached } from "./walk";

export type PWCFactory<C extends PerWindowComponent> = {
    new (use: Context, item: o.WorkspaceContainer): C
    onload(use: Context): void;
    onunload(use: Context): void;
}

/**
 * Component that belongs to a plugin + window. e.g.:
 *
 *     class TitleWidget extends PerWindowComponent {
 *         onload() {
 *             // do stuff with this.win ...
 *         }
 *     }
 *
 *     class MyPlugin extends Plugin {
 *         titleWidget = this.use(TitleWidget).watch();
 *         ...
 *     }
 *
 * This will automatically create a title widget for each window as it's opened, and
 * on plugin load.  The plugin's `.titleWidget` will also be a WindowManager that can
 * look up the title widget for a given window, leaf, or view, or return a list of
 * all of them.  (e.g. `this.titleWidget.forWindow(...)`)  See WindowManager for the
 * full API.
 *
 * If you want your components to be created lazily only on-demand instead of eagerly
 * and automatically, you can leave off the `.watch()` call, e.g.
 * `titleWidget = this.use(TitleWidget)` instead.
 */
export class PerWindowComponent extends o.Component {

    win = this.container.win;

    constructor(public use: Context, public container: o.WorkspaceContainer) {
        super();
    }

    [use.factory]() {
        return new WindowManager(this.constructor as PWCFactory<this>);
    }

    // Allow PWC's to provide a static initializer -- handy for setting up event dispatching
    static onload(use: Context) {}
    static onunload(use: Context) {}
}

/**
 * Manage per-window components
 */
export class WindowManager<T extends PerWindowComponent> extends Service {

    instances = new Map<o.WorkspaceContainer, T>();

    constructor (
        public factory: PWCFactory<T>,  // The class of thing to manage
    ) {
        super();
    }

    watching: boolean = false
    layoutReadyCallbacks = [];

    onload() {
        this.registerEvent(app.workspace.on("layout-change", () => {
            if (app.workspace.layoutReady && this.layoutReadyCallbacks.length) {
                this.layoutReadyCallbacks.forEach(defer);
                this.layoutReadyCallbacks = [];
            }
        }));
        this.factory.onload?.(this.use);
    }

    // Only get safe active-leaf-change events, plus get an initial one on workspace load
    onLeafChange(cb: (leaf: o.WorkspaceLeaf) => any, ctx?: any) {
        this.onLayoutReady(() => cb.call(ctx, app.workspace.activeLeaf));
        return app.workspace.on("active-leaf-change", leaf => {
            if (app.workspace.layoutReady) cb.call(ctx, leaf);
        });
    }

    // A version of workspce.onLayoutReady that will defer callbacks if the workspace is being replaced
    onLayoutReady(cb: () => any) {
        if (app.workspace.layoutReady) defer(cb); else this.layoutReadyCallbacks.push(cb);
    }

    onunload() { this.factory.onunload?.(this.use); }

    watch(): this {
        // Defer watch until plugin is loaded
        if (!this._loaded) onLoad(this, () => this.watch());
        else if (!this.watching) {
            const {workspace} = app, self = this;
            this.watching = true;
            this.registerEvent(
                workspace.on("window-open", container => {
                    this.onLayoutReady(() => this.forContainer(container));
                })
            );
            this.register(around(workspace, {
                clearLayout(old) {
                    return async function clearLayout() {
                        try {
                            return await old.call(this);
                        } finally {
                            // Check for new containers (mainly the rootSplit) after a workspace change
                            self.onLayoutReady(() => self.forAll());
                        }
                    }
                }
            }));
            this.onLayoutReady(() => this.forAll());
        }
        return this;
    }

    forWindow(): T
    forWindow(win: Window): T
    forWindow(win: Window, create: true): T
    forWindow(win: Window, create: boolean): T | undefined

    forWindow(win: Window = window.activeWindow ?? window, create = true): T | undefined {
        const container = containerForWindow(win);
        if (container) return this.forContainer(container, create);
    }

    forContainer(container: o.WorkspaceContainer): T
    forContainer(container: o.WorkspaceContainer, create: true): T
    forContainer(container: o.WorkspaceContainer, create: boolean): T | undefined

    forContainer(container: o.WorkspaceContainer, create = true): T | undefined {
        container = container.getContainer(); // always get root-most container
        let inst = this.instances.get(container);
        if (!inst && create) {
            inst = new this.factory(this.use, container);
            if (inst) {
                this.instances.set(container, inst);
                this.addChild(inst);  // unload when plugin does
                container.component.addChild(inst);  // or if the window closes/workspace changes
                inst.register(() => {
                    // Don't keep it around after unload
                    safeRemoveChild(this, inst);
                    safeRemoveChild(container.component, inst);
                    this.instances.delete(container);
                });
            }
        }
        return inst;
    }

    forDom(el: HTMLElement): T
    forDom(el: HTMLElement, create: true): T
    forDom(el: HTMLElement, create: boolean): T | undefined

    forDom(el: HTMLElement, create = true): T | undefined {
        return this.forWindow(windowForDom(el), create);
    }

    forLeaf(): T
    forLeaf(leaf: o.WorkspaceLeaf): T
    forLeaf(leaf: o.WorkspaceLeaf, create: true): T
    forLeaf(leaf: o.WorkspaceLeaf, create: boolean): T | undefined

    forLeaf(leaf: o.WorkspaceLeaf = app.workspace.activeLeaf, create = true): T | undefined {
        if (isLeafAttached(leaf)) return this.forContainer(leaf.getContainer(), create);
    }

    forView(view: o.View): T
    forView(view: o.View, create: true): T
    forView(view: o.View, create: boolean): T | undefined

    forView(view: o.View, create = true): T | undefined {
        return this.forLeaf(view.leaf, create);
    }

    forAll(create = true) {
        return allContainers().map(c => this.forContainer(c, create)).filter(t => t);
    }
}

export function allContainers(): o.WorkspaceContainer[] {
    return [app.workspace.rootSplit].concat(app.workspace.floatingSplit.children);
}

export function allWindows() {
    return allContainers().map(c => c.win);
}

export function numWindows() {
    return 1 + (app.workspace.floatingSplit?.children.length ?? 0);
}

export function windowEvent(cond: (win: Window, evt: Event) => boolean): Event {
    for (const win of allWindows()) {
        if (win.event && cond(win, win.event)) return win.event;
    }
}

export function windowForDom(el: Node) {
    // Backward compat to 0.14, which has no .win on nodes; can just use el.win on 0.15.6+
    return el.win || (el.ownerDocument || <Document>el).defaultView || window;
}

export function containerForWindow(win: Window): o.WorkspaceContainer {
    if (win === window) return app.workspace.rootSplit;
    const {floatingSplit} = app.workspace;
    if (floatingSplit) {
        for(const split of floatingSplit.children) if (win === split.win) return split;
    }
}

export function focusedContainer(): o.WorkspaceContainer | undefined {
    return allContainers().filter(c => c.win.document.hasFocus()).pop();
}
