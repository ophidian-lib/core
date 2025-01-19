import { defer, root } from "uneventful";
import { obsidian as o } from "./obsidian.ts";
export var app: o.App, plugin: o.Plugin

export function setPlugin(p: o.Plugin) {
    plugin = p
    app = p.app
    // Ensure the plugin ends the root job on unload
    plugin.register(() => defer(root.end))
}
