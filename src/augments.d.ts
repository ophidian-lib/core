/**
 * All type augments for external packages MUST go here, so they can be concat'd
 * on the end of our dist/index.d.ts.  This is necessary because tsup (or more
 * precisely, rollup-plugin-dts) absolutely *hates* declaration merging and
 * mangles the crap out of it if you do stuff in different files.
 */

import o from "obsidian";

declare module "obsidian" {
    interface Workspace {
        floatingSplit?: WorkspaceParent & { children: WorkspaceWindow[] };
        clearLayout(): Promise<void>
        "ophidian:layout-settings"?: any
    }
    interface WorkspaceItem {
        component: Component
        serialize(): any;
        "ophidian:layout-settings"?: any
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
    interface App {
        appId: string;
    }
    interface Workspace {
        setLayout(layout: any): Promise<void>;
        clearLayout(): Promise<void>;
        deserializeLayout(state: any, ...etc: any[]): Promise<WorkspaceItem>;
    }
    interface Plugin {
        loadCSS(): Promise<void>;
    }
    interface WorkspaceParent {
        children: WorkspaceItem[]
    }
}

declare module "to-use" {
    interface GlobalContext {
        service(service: o.Component): Context
        plugin(plugin: o.Plugin): Context
    }
}