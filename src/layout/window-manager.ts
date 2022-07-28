import { Component, View, Workspace, WorkspaceContainer, WorkspaceLeaf } from "obsidian";
import { Context, Service, use, onLoad } from "../services";
import { defer } from "../defer";
import { around } from "monkey-around";

type PWCFactory<T extends PerWindowComponent> = {
    new (use: Context, container: WorkspaceContainer): T
    onload(m: WindowManager<T>): void;
    onunload(m: WindowManager<T>): void;
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
 *         titleWidget = this.use(TitleWidget);
 *         ...
 *     }
 *
 * This will automatically create a title widget for each window as it's opened, and
 * on plugin load.  The plugin's `.titleWidget` will also be a WindowManager that can
 * look up the title widget for a given window, leaf, or view, or return a list of
 * all of them.  (e.g. `this.titleWidget.forWindow(...)`)  See WindowManager for the
 * full API.
 *
 * If you want your components to be created all at once for any existing windows
 * and automatically for any windows opened in the future, you can call `watch()`
 * on the resulting item, e.g. `titleWidget = this.use(TitleWidget).watch()`.
 */
export class PerWindowComponent extends Component {

    win = this.container.win;

    constructor(public use: Context, public container: WorkspaceContainer) {
        super();
    }

    [use.factory]() {
        return new WindowManager(this.constructor as PWCFactory<typeof this>);
    }

    // Allow PWC's to provide a static initializer -- handy for setting up event dispatching
    static onload(wm: WindowManager<typeof this.prototype>) {}
    static onunload(wm: WindowManager<typeof this.prototype>) {}
}

/**
 * Manage per-window components
 */
export class WindowManager<T extends PerWindowComponent> extends Service {

    instances = new WeakMap<Window, T>();

    constructor (
        public factory: PWCFactory<T>,  // The class of thing to manage
    ) {
        super();
    }

    watching: boolean = false
    layoutReadyCallbacks = [];

    onload() {
        const self = this;
        this.registerEvent(app.workspace.on("layout-change", () => {
            if (app.workspace.layoutReady && this.layoutReadyCallbacks.length) {
                this.layoutReadyCallbacks.forEach(defer);
                this.layoutReadyCallbacks = [];
            }
        }));
        this.register(around(Workspace.prototype, {
            clearLayout(old) {
                return function clearLayout() {
                    self.instances.get(window)?.unload();
                    self.instances.delete(window);
                    return old.call(this);
                }
            }
        }));
        this.factory.onload?.(this);
    }

    onLeafChange(cb: (leaf: WorkspaceLeaf) => any, ctx?: any) {
        this.onLayoutReady(() => cb.call(ctx, app.workspace.activeLeaf));
        return app.workspace.on("active-leaf-change", leaf => {
            if (app.workspace.layoutReady) cb.call(ctx, leaf);
        });
    }

    onLayoutReady(cb: () => any) {
        if (app.workspace.layoutReady) defer(cb); else this.layoutReadyCallbacks.push(cb);
    }

    onunload() { this.factory.onunload?.(this); }

    watch(): this {
        // Defer watch until plugin is loaded
        if (!this._loaded) onLoad(this, () => this.watch());
        else if (!this.watching) {
            const {workspace} = app;
            this.watching = true;
            this.registerEvent(
                workspace.on("window-open", (_, win) => {
                    this.onLayoutReady(() => this.forWindow(win));
                })
            );
            this.onLayoutReady(() => this.forAll());
        }
        return this;
    }

    forWindow(): T;
    forWindow(win: Window): T;
    forWindow(win: Window, create: true): T;
    forWindow(win: Window, create: boolean): T | undefined;

    forWindow(win: Window = window.activeWindow ?? window, create = true): T | undefined {
        let inst = this.instances.get(win);
        if (!inst && create) {
            const container = containerForWindow(win)
            if (container) return this.forContainer(container);
        }
        return inst || undefined;
    }

    forContainer(container: WorkspaceContainer): T;
    forContainer(container: WorkspaceContainer, create: true): T;
    forContainer(container: WorkspaceContainer, create: boolean): T | undefined;
    forContainer(container: WorkspaceContainer, create = true) {
        const {win} = container;
        let inst = this.instances.get(win);
        if (!inst && create) {
            inst = new this.factory(this.use, container);
            if (inst) {
                this.instances.set(win, inst!);
                inst.registerDomEvent(win, "beforeunload", () => {
                    this.removeChild(inst!);
                    this.instances.delete(win);
                });
                this.addChild(inst);
            }
        }
        return inst;
    }

    forDom(el: HTMLElement): T;
    forDom(el: HTMLElement, create: true): T;
    forDom(el: HTMLElement, create: boolean): T | undefined;

    forDom(el: HTMLElement, create = true) {
        return this.forWindow(windowForDom(el), create);
    }

    forLeaf(leaf: WorkspaceLeaf = app.workspace.activeLeaf, create = true): T | undefined {
        if (app.workspace.isLeafAttached(leaf)) return this.forContainer(leaf.getContainer(), create);
    }

    forView(view: View): T;
    forView(view: View, create: true): T;
    forView(view: View, create: boolean): T | undefined;

    forView(view: View, create = true) {
        return this.forLeaf(view.leaf, create);
    }

    forAll(create = true) {
        return allContainers().map(c => this.forContainer(c, create)).filter(t => t);
    }
}

export function allContainers() {
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

export function containerForWindow(win: Window): WorkspaceContainer {
    if (win === window) return app.workspace.rootSplit;
    const {floatingSplit} = app.workspace;
    if (floatingSplit) {
        for(const split of floatingSplit.children) if (win === split.win) return split;
    }
}

declare module "obsidian" {
    interface Workspace {
        floatingSplit?: WorkspaceParent & { children: WorkspaceWindow[] };
        clearLayout(): Promise<void>
        isLeafAttached(leaf: WorkspaceLeaf): boolean
    }
    interface WorkspaceWindow extends WorkspaceParent {
        win: Window
    }
    interface WorkspaceLeaf {
        containerEl: HTMLDivElement;
    }
    interface Component {
        _loaded: boolean
    }
}
