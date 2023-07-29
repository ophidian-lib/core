import defaults from "defaults";
import { defer, taskQueue } from "./defer";
import { obsidian as o } from "./obsidian";
import { Service, Useful, getContext, onLoad } from "./services";
import { cloneValue } from "./clone-value";
import { computed, effect, signal } from "@preact/signals-core";

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
    owner: o.Component & Partial<Useful>,
    defaultSettings?: T,
    applySettings?: (settings: T) => void
) {
    const svc = getContext(owner)(SettingsService) as SettingsService<T>;
    if (defaultSettings) svc.addDefaults(defaultSettings);
    if (applySettings) owner.register(svc.onChange(applySettings));
    return svc;
}

export class SettingsService<T extends {}> extends Service {
    private plugin = this.use(o.Plugin);
    private queue = taskQueue();
    private data = {} as T;
    private version = signal(0);
    private cloned = computed(() => this.version.value ? cloneValue(this.data) : null)

    get current() { return this.cloned.value; }

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
                (await this.plugin.loadData()) ?? {}, this.current
            )
            this.version.value++;
        }, console.error)
    }

    onChange(callback: (settings: T) => any, ctx?: any): () => void {
        return effect(() => {
            if (this.current) defer(callback.bind(ctx, this.current));
        });
    }

    update(op: (val:T) => T|void) {
        return <Promise<T>> this.queue(async () => {
            const oldData = this.data;
            const oldJSON = JSON.stringify(oldData);
            try {
                var newData = JSON.parse(oldJSON);
                newData = op(newData) ?? newData;
                const newJSON = JSON.stringify(newData);
                if (oldJSON !== newJSON) {
                    this.data = newData;
                    this.version.value++;
                    await this.plugin.saveData(JSON.parse(newJSON)).catch(console.error);
                }
            } catch(e) {
                console.error(e);
            }
        });
    }
}