import { around } from "monkey-around";
import { Service } from "../services";
import { Plugin } from "obsidian";

/** use() this to make your plugin support dynamic Style Settings
 *
 * Currently, Obsidian doesn't announce CSS changes when plugins
 * load, so Style Settings doesn't update when you update a plugin
 * or install a new one.  This service takes care of that for you,
 * telling Style Settings to update after a plugin loads its CSS.
 *
 * To take effect, this service must be use()d as a plugin property,
 * or else it will miss the timing to capture the loadCSS event.
**/
export class StyleSettings extends Service {
    onload() {
        const self = this, plugin = this.use(Plugin);
        this.register(around(plugin, {
            loadCSS(old) { return async function() {
                await old.call(this);
                self.triggerReparse();
                this.register(() => self.triggerReparse())
            }; }
        }));
    }

    triggerReparse() {
        if (app.workspace.layoutReady) app.workspace.trigger("parse-style-settings");
    }
}

declare module "obsidian" {
    interface Plugin {
        loadCSS(): Promise<void>;
    }
}