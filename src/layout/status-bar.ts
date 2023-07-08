import { obsidian as o } from "../obsidian";
import { Useful } from "to-use";
import { defer } from "../defer";

export function statusBarItem(
    owner: o.Component & Useful,
    win: Window = window,
    cls: string = "plugin-" + owner.use(o.Plugin).manifest.id.toLowerCase().replace(/[^_a-zA-Z0-9-]/, "-")
) {
    let container = win.document.querySelector("body > .app-container");
    let statusBar = container.find(".status-bar") || container.createDiv("status-bar");
    let statusBarItem = statusBar.find(".status-bar-item."+cls) ||
        statusBar.createDiv(`status-bar-item ${cls.replace(/\./g,' ')}`);
    container = null;
    owner.register(() => defer(() => { // allow for other unload operations to finish
        statusBarItem = maybeDetach(statusBarItem);
        if (win !== window) statusBar = maybeDetach(statusBar);
    }));
    owner.use(o.Plugin).register(() => statusBarItem && statusBarItem.detach());
    return statusBarItem;
}

function maybeDetach(item: Element) {
    return (item && !item.hasChildNodes()) ? (item.detach(), null): item;
}