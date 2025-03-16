import { around } from "monkey-around";
import { Service, app } from "../services.ts";
import { obsidian as o } from "../obsidian.ts";

/**
 * Fetch style sheet settings for a specified style sheet
 *
 * @param sheetID The `id` from the style sheet comment identifying a settings
 * group
 *
 * @returns A mapping of field IDs to values; empty if no style settings are
 * present for the identified style sheet.  (Note that in some cases, field IDs
 * may be something like `some-thing@@other-thing`.)
 *
 * @category Settings Management
 */
export async function styleSettingsFor(sheetID: string) {
    const res: Record<string, any> = {}
    try {
        Object.entries(
            JSON.parse(
                await app.vault.adapter.read(
                    `${app.plugins.getPluginFolder()}/obsidian-style-settings/data.json`
                )
            )
        ).forEach(([k, v]) => {
            const parts = k.split("@@"), sid = parts.shift(), key = parts.join("@@");
            if (sid === sheetID) res[key] = v
        })
        return res;
    } catch (e) {
        if (e.code === "ENOENT") return {};
        throw e;
    }
}

/**
 * use() this to make your plugin support dynamic Style Settings
 *
 * Currently, Obsidian doesn't announce CSS changes when plugins load, so Style
 * Settings doesn't update when you update a plugin or install a new one.  This
 * service takes care of that for you, telling Style Settings to update after a
 * plugin loads its CSS.
 *
 * To take effect, this service must be use()d as a plugin property, or else it
 * will miss the timing to capture the loadCSS event.
 */
export class StyleSettings extends Service {
    onload() {
        const self = this, plugin = this.use(o.Plugin);
        this.register(around(plugin, {
            loadCSS(old) { return async function() {
                await old.call(this);
                self.triggerReparse();
                this.register(() => self.triggerReparse())
            }; }
        }));
    }

    triggerReparse() {
        app.workspace.onLayoutReady(() => app.workspace.trigger("parse-style-settings"));
    }
}
