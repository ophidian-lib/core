import { Component, View, WorkspaceContainer, WorkspaceLeaf } from "obsidian";
import { Context, Service, use, onLoad } from "../services";
import { defer } from "../defer";
import { around } from "monkey-around";
import { isLeafAttached } from "./walk";

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

    instances = new Map<WorkspaceContainer, T>();

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
        this.factory.onload?.(this);
    }

    // Only get safe active-leaf-change events, plus get an initial one on workspace load
    onLeafChange(cb: (leaf: WorkspaceLeaf) => any, ctx?: any) {
        this.onLayoutReady(() => cb.call(ctx, app.workspace.activeLeaf));
        return app.workspace.on("active-leaf-change", leaf => {
            if (app.workspace.layoutReady) cb.call(ctx, leaf);
        });
    }

    // A version of workspce.onLayoutReady that will defer callbacks if the workspace is being replaced
    onLayoutReady(cb: () => any) {
        if (app.workspace.layoutReady) defer(cb); else this.layoutReadyCallbacks.push(cb);
    }

    onunload() { this.factory.onunload?.(this); }

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

    forWindow(win: Window = window.activeWindow ?? window, create = true): T | undefined {
        const container = containerForWindow(win);
        if (container) return this.forContainer(container, create);
    }

    forContainer(container: WorkspaceContainer, create = true): T | undefined {
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

    forDom(el: HTMLElement, create = true): T | undefined {
        return this.forWindow(windowForDom(el), create);
    }

    forLeaf(leaf: WorkspaceLeaf = app.workspace.activeLeaf, create = true): T | undefined {
        if (isLeafAttached(leaf)) return this.forContainer(leaf.getContainer(), create);
    }

    forView(view: View, create = true): T | undefined {
        return this.forLeaf(view.leaf, create);
    }

    forAll(create = true) {
        return allContainers().map(c => this.forContainer(c, create)).filter(t => t);
    }
}

export function safeRemoveChild(parent: Component, child: Component) {
    if (parent._loaded) parent.removeChild(child);
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
    }
    interface WorkspaceItem {
        component: Component
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
