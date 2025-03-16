/**
 * All type augments for external packages MUST go here, so they can be concat'd
 * on the end of our dist/index.d.ts.  This is necessary because tsup (or more
 * precisely, rollup-plugin-dts) absolutely *hates* declaration merging and
 * mangles the crap out of it if you do stuff in different files.
 *
 * (Also, if you do any *class* augmentation anywhere other than this file,
 * rollup-plugin-dts turns the augmented classes into `export type` in
 * index.d.ts, because it thinks they're only interfaces, not classes augmented
 * with an interface.)
 */

import * as o from "obsidian";

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
        /** @internal */
        _loaded: boolean
    }
    interface App {
        appId: string;
        plugins: _Plugins
    }
    interface Workspace {
        setLayout(layout: any): Promise<void>;
        clearLayout(): Promise<void>;
        deserializeLayout(state: any, ...etc: any[]): Promise<WorkspaceItem>;
    }
    interface Plugin {
        loadCSS(): Promise<void>;
        onExternalSettingsChange?(): any
    }
    interface WorkspaceParent {
        children: WorkspaceItem[]
    }
    interface _Plugins {
        getPluginFolder(): string
    }
}

declare module "to-use" {
    interface GlobalContext {
        service(service: o.Component): Context
        plugin(plugin: o.Plugin): Context
    }
}