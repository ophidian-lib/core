import { default as setDefaults } from "defaults";
import { Writable, cached, rule, until, value } from "uneventful/signals";
import { service } from "uneventful/shared";
import { setMap } from "./add-ons.ts";
import { taskQueue } from "./defer.ts";
import { cloneValue } from "./clone-value.ts";
import { around } from "monkey-around";
import { DisposeFn, OptionalCleanup, UntilMethod, Yielding, must } from "uneventful";
import type { JSON, JSONObject, JSONValue } from "./JSON.ts";
import { plugin } from "./plugin.ts";

/** @inline */
type SettingsMigration<T> = (old: T) => (T | Promise<T|void> | PromiseLike<T|void> | void)

export const settings = /* @__PURE__ */ (() => {
    /**
     * Define setting defaults + migrations, and get setting helpers.
     *
     * Calling settings() with an object of defaults (and an optional migration
     * function) gets you an object you can extract {@link Writable} helpers
     * from, for accessing individual settings. e.g.:
     *
     * ```ts
     * interface MySettings { a: number; b: string; }
     * const {a, b} = settings<MySettings>({})
     * a.set(42); b.set("foo");
     * ```
     *
     * The helpers are reactive values that also work as streams, i.e. you can
     * use them in rules or pipe them through stream operators.  They will throw
     * an error if used before any settings are loaded, however, so you will
     * need to only use them in either a `rule.if(settings, () => {...})` block
     * or after a `yield *until(settings)` in an async job.
     *
     * Note that you can call `settings({...})` more than once with different
     * types, defaults, and migration functions, extracting different helpers in
     * different modules. Generally speaking, you should do this at the top
     * level of your module, then set up handlers (e.g. rules, streams, etc.)
     * within your service to monitor or update the settings.
     *
     * @param defaults An object containing setting defaults.   This argument
     * *must* be present in order to get helpers, even if you aren't defining
     * any defaults.  (If the defaults are omitted or falsy, settings() returns
     * the loaded settings, or null if they aren't currently loaded - see the
     * second overload for details.)
     *
     * @param migrate Optional - A function that will be called with an on-disk
     * version of the settings, and should return an updated value (for handling
     * versioning of your settings schema).  The function can be async, in case
     * you need to fetch data from elsewhere, prompt the user, save the changes,
     * upgrade data in notes, etc. etc. The function can return void or a falsy
     * value if you only want it to execute for side-effects and/or modify the
     * data in-place.
     *
     * @category Settings Management
     */
    function settings<T>(defaults: JSON<T>, migrate?: SettingsMigration<JSON<T>>): {[K in keyof T]: Writable<T[K]>}

    /**
     * Get the current settings as a reactive value, or null if not loaded.
     *
     * This is a reactive value that refreshes when settings load or change, so
     * you can e.g. use `rule.if(settings, () => {})` to start a rule once
     * settings are loaded.  (You can also use `yield *until(settings)` to
     * wait for settings to be loaded in an async task.)
     */
    function settings<T=JSONObject>(): JSON<T>

    function settings<T>(defaults?: JSON<T>, migrate?: SettingsMigration<JSON<T>>) {
        useIO()
        if (defaults) {
            defaultSettings.set(JSON.stringify(setDefaults(
                JSON.parse(defaultSettings()) as JSON<T>, cloneValue(defaults)
            )))
            if (migrate) migrations.push(migrate)
            return settingsProxy
        } else {
            return settingsLoaded() ? cookedSettings() : null
        }
    }

    const defaultSettings = value("{}")
    const rawSettings = value("null"), onDisk = value("null")
    const settingsLoaded = value(false)
    const settingsJSON = cached(() => JSON.stringify(setDefaults(
        JSON.parse(rawSettings()) || {}, JSON.parse(defaultSettings())
    )))
    const cookedSettings = cached(() => JSON.parse(settingsJSON()))
    const migrations: SettingsMigration<JSONObject>[] = []
    const helpers = new Map<string, Writable<JSONValue>>()
    const settingsProxy = new Proxy({}, { get(_, prop) {
        if (typeof prop === "string") {
            return helpers.get(prop) || setMap(helpers, prop, cached<JSONValue>(
                () => {
                    throwUnlessLoaded()
                    return cookedSettings()[prop]
                }
            ).withSet(v => {
                throwUnlessLoaded()
                rawSettings.set(JSON.stringify(
                    {...JSON.parse(rawSettings()), [prop]: v}
                ))
            }))
        }
    }})

    const io = taskQueue(), ioRule = rule.factory(io), useIO = service(ioHandler)
    return withRuleAndEdit(withUntil(settings, function*(){ return yield *until(settingsLoaded); }))

    function *ioHandler() {
        // Track external settings changes and trigger loads (This must be done
        // before first loadData as Obsidian expects the onExternalSettingsChange method
        // to be present at load time to enable tracking.)
        must(around(plugin, { onExternalSettingsChange(old) {
            const nextFn = plugin.onExternalSettingsChange
            return function() {
                io(loadData)
                if (nextFn) old.call(this)
            }
        }}))

        // Once the plugin is initialized, queue a data load
        io(loadData)

        // And once it's done, begin monitoring setting changes
        // to write them to disk
        ioRule(() => {
            if (rawSettings() != onDisk()) io(saveData)
        })

        // And reset the loaded flag to false when the plugin unloads
        must(() => settingsLoaded.set(false))

        async function saveData() {
            const toWrite = rawSettings()
            if (toWrite != onDisk()) {
                await plugin.saveData(JSON.parse(toWrite))
                onDisk.set(toWrite)
                // XXX sleep here to enforce a max save rate?
            }
        }

        async function loadData() {
            let data = (await plugin.loadData()) || {}
            for(const m of migrations) data = (await m(data)) || data
            const j = JSON.stringify(data)
            onDisk.set(j)
            rawSettings.set(j)
            settingsLoaded.set(true)
        }
    }

    function throwUnlessLoaded() {
        if (!settingsLoaded()) throw new Error("Settings not loaded yet")
    }

    function withUntil<T extends object, R>(ob: T, until: () => Yielding<R>): T & UntilMethod<R> {
        return Object.assign(ob, {"uneventful.until": until})
    }

    function withRuleAndEdit<T extends object>(ob: T) {
        return Object.assign(ob, {
            /**
             * Create a rule that will run when settings are loaded
             *
             * @param action The rule body, which can return a cleanup function
             * (or use regular job APIs).  The rule can directly use a specific
             * setting, or configure nested rules or subscriptions for
             * individual settings, or even call settings() to get all the
             * settings (in which case it will rerun on **every** settings
             * change.)
             */
            rule(action: () => OptionalCleanup): DisposeFn {
                useIO() // ensure settings load and update
                return rule.root(() => { if (settingsLoaded()) return action() })
            },
            /**
             * Asynchronously update current settings using an update function
             *
             * Note: this mainly exists for backward compatibility with the old
             * {@link SettingsService} interface; you should usually just .edit()
             * or .set() individual settings instead of using this.
             *
             * @param update A function taking the current settings, which must
             * then return an updated version of the settings, or else modify them
             * in place and return nothing.  The function is only run after any
             * current I/O finishes (i.e. loading or saving)
             *
             * @returns A promise for the updated settings
             */
            edit<T>(update: (old: JSON<T>) => JSON<T>|void): Promise<JSON<T>> {
                useIO() // ensure settings load and update
                return io(() => {
                    const oldVal = cloneValue(cookedSettings() as JSON<T>)
                    const newVal = update(oldVal) || oldVal
                    rawSettings.set(JSON.stringify(newVal))
                    return newVal
                })
            }
        })
    }
})()
