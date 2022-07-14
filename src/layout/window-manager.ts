import { Component, View, WorkspaceLeaf, WorkspaceParent } from "obsidian";
import { Context, Service, use } from "../services";
import { defer } from "../defer";

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

    get container(): WorkspaceParent {
        return containerForWindow(this.win);
    }

    constructor(public use: Context, public win: Window) {
        super();
    }

    [use.factory]() {
        return new WindowManager(this.constructor as new (use: Context, win: Window) => typeof this)
    }
}

/**
 * Manage per-window components
 */
export class WindowManager<T extends PerWindowComponent> extends Service {

    instances = new WeakMap<Window, T>();

    constructor (
        public factory: new (use: Context, win: Window) => T,  // The class of thing to manage
    ) {
        super();
    }

    watching: boolean = false

    watch(): this {
        // Defer watch until plugin is loaded
        if (!this._loaded) this.onload = () => this.watch();
        else if (!this.watching) {
            const {workspace} = app;
            this.watching = true;
            this.registerEvent(
                workspace.on("window-open", (_, win) => {
                    workspace.onLayoutReady(() => defer(() => this.forWindow(win)));
                })
            );
            workspace.onLayoutReady(() => defer(() => this.forAll()));
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
            inst = new this.factory(this.use, win);
            if (inst) {
                this.instances.set(win, inst!);
                inst.registerDomEvent(win, "beforeunload", () => {
                    this.removeChild(inst!);
                    this.instances.delete(win);
                });
                this.addChild(inst);
            }
        }
        return inst || undefined;
    }

    forDom(el: HTMLElement): T;
    forDom(el: HTMLElement, create: true): T;
    forDom(el: HTMLElement, create: boolean): T | undefined;

    forDom(el: HTMLElement, create = true) {
        return this.forWindow(windowForDom(el), create);
    }

    forLeaf(leaf: WorkspaceLeaf): T;
    forLeaf(leaf: WorkspaceLeaf, create: true): T;
    forLeaf(leaf: WorkspaceLeaf, create: boolean): T | undefined;

    forLeaf(leaf: WorkspaceLeaf, create = true) {
        return this.forDom(leaf.containerEl, create);
    }

    forView(view: View): T;
    forView(view: View, create: true): T;
    forView(view: View, create: boolean): T | undefined;

    forView(view: View, create = true) {
        return this.forLeaf(view.leaf, create);
    }

    forAll(create = true) {
        return allWindows().map(win => this.forWindow(win, create)).filter(t => t);
    }
}

export function allWindows() {
    const windows: Window[] = [window], {floatingSplit} = app.workspace;
    if (floatingSplit) {
        for(const split of floatingSplit.children) if (split.win) windows.push(split.win);
    }
    return windows;
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

export function containerForWindow(win: Window): WorkspaceParent {
    if (win === window) return app.workspace.rootSplit;
    const {floatingSplit} = app.workspace;
    if (floatingSplit) {
        for(const split of floatingSplit.children) if (win === split.win) return split;
    }
}

declare module "obsidian" {
    interface Workspace {
        floatingSplit?: WorkspaceParent & { children: WorkspaceWindow[] };
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
