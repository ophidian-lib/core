import { obsidian as o } from "./obsidian.ts";
import { Service, Useful, getContext } from "./services.ts";
import { cloneValue } from "./clone-value.ts";
import { peek } from "uneventful/signals";
import { settings } from "./settings.ts";
import { JSONObject } from "./JSON.ts";

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
 *         settings = useSettings<MySettings>(
 *             this,   // plugin or other owner
 *             {...},  // default settings
 *             (settings) => {
 *                 // code that runs when settings are loaded or changed
 *             },
 *             (settings) => {
 *                 // code to do one-time setup only
 *             }
 *         )
 *     }
 *
 * @param owner            The service or plugin
 * @param defaultSettings  (Optional) The default settings to use
 * @param each             (Optional) A function to call with settings each time they're loaded or changed
 * @param once             (Optional) A function to call with settings once, as soon as they're available
 *
 * @returns A {@link SettingsService} you can use to `.update()` the settings
 *
 * @category Settings Management
 */
export function useSettings<T extends JSONObject>(
    owner: o.Component & Partial<Useful>,
    defaultSettings?: T,
    each?: (settings: T) => void,
    once?: (settings: T) => void,
) {
    const svc = getContext(owner)(SettingsService) as SettingsService<T>;
    if (defaultSettings) svc.addDefaults(defaultSettings);
    if (once) owner.register(svc.once(once));
    if (each) owner.register(svc.each(each));
    return svc;
}

/** @category Settings Management */
export class SettingsService<T extends JSONObject> extends Service {
    get = () => cloneValue(settings() as T)

    get current() { return this.get(); }

    addDefaults(defaults: T) {
        settings(defaults)
    }

    once(callback: (settings: T) => any, ctx?: any): () => void {
        // each() will defer the callback, so it won't actually run before unsub is set
        const unsub =  this.each(data => { unsub(); callback.call(ctx, data); });
        return unsub;
    }

    each(callback: (settings: T) => any, ctx?: any): () => void {
        return settings.rule(() => {
            peek(callback.bind(ctx, this.get()));
        });
    }

    /** @deprecated Use .each() instead */
    onChange(callback: (settings: T) => any, ctx?: any): () => void {
        return this.each(callback, ctx);
    }

    update(op: (val:T) => T|void) {
        return settings.edit(op)
    }
}
