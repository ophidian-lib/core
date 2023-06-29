import defaults from "defaults";
import { taskQueue } from "./defer";
import { Component, EventRef, Events, Plugin } from "./obsidian";
import { Service, Useful, getContext, onLoad } from "./services";
import { cloneValue } from "./clone-value";

/**
 * ### Safe, simple, and centralized setting state management
 *
 * useSettings() lets you avoid code duplication, boilerplate, and unnecessary
 * use of the `async onload()` anti-pattern, while also allowing settings
 * management to be divided among multiple components.
 *
 * Just give it a callback that will be invoked with new settings values (including
 * when the settings initially load), and you get back a {@link SettingsService}
 * whose `update()` method you can call to update the settings.  No need to touch
 * loadData or saveData, or to duplicate code between your settings tab and your
 * onload (not to mention any settings-changing commands!).
 *
 * Instead, your settings tab (and/or commands) can just call `.update()` to update
 * the state, and the changes will be saved and propagated automatically.  You can
 * also split your settings into parts managed by different services (as with
 * {@link useSettingsTab}), so you don't end up with a giant blob of code for
 * settings application.
 *
 * Example:
 *
 *     type MySettings = {...};
 *
 *     class MyPlugin extends Plugin {
 *         settings = useSettings(
 *             this,   // plugin or other owner
 *             {...} as MySettings,  // default settings
 *             (settings: MySettings) => {
 *                 // code to init or update plugin state from settings
 *             }
 *         )
 *     }
 *
 * @param owner            The service or plugin
 * @param defaultSettings  (Optional) The default settings to use
 * @param applySettings    (Optional) A function to call when settings are loaded or changed
 *
 * @returns A {@link SettingsService} you can use to `.update()` the settings
 */
export function useSettings<T>(
    owner: Component & Partial<Useful>,
    defaultSettings?: T,
    applySettings?: (settings: T) => void
) {
    const svc = getContext(owner)(SettingsService) as SettingsService<T>;
    if (defaultSettings) svc.addDefaults(defaultSettings);
    if (applySettings) owner.registerEvent(svc.onChange(applySettings));
    return svc;
}

export class SettingsService<T extends {}> extends Service {
    private events = new Events;
    private plugin = this.use(Plugin);
    private queue = taskQueue();
    private data = {} as T;

    addDefaults(settings: T) {
        // We can do this without queueing, as it will not update existing values,
        // and if the values are defaults, there's no need to trigger an event.
        this.data = <T> defaults(this.data, settings);
    }

    constructor() {
        super();
        this.queue(async () => {
            await new Promise(res => onLoad(this.plugin, res as () => any));
            this.data = <T> defaults(
                (await this.plugin.loadData()) ?? {},
                cloneValue(this.data)
            )
        }, console.error)
    }

    onChange(callback: (settings: T) => any, ctx?: any): EventRef {
        this.queue(() => callback(cloneValue(this.data)), console.error)
        return this.events.on("change", callback, ctx);
    }

    update(op: (val:T) => void) {
        return <Promise<T>> this.queue(async () => {
            const oldJSON = JSON.stringify(this.data);
            try {
                op(this.data);
                const newJSON = JSON.stringify(this.data);
                if (oldJSON !== newJSON) {
                    this.events.trigger("change", this.data);
                    this.data = JSON.parse(newJSON);
                    await this.plugin.saveData(this.data).catch(console.error);
                }
            } catch(e) {
                console.error(e);
                this.data = JSON.parse(oldJSON);
            }
        });
    }
}