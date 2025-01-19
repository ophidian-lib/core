import { obsidian as o } from "./obsidian.ts";
export var app: o.App, plugin: o.Plugin

export function setPlugin(p: o.Plugin) {
    plugin = p
    app = p.app
}
