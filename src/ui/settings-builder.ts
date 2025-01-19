import { Component, PluginSettingTab, Setting } from "obsidian";
import { obsidian as o } from "../obsidian.ts";
import { Useful, getContext } from "../services.ts";
import { peek, rule, until, value } from "uneventful/signals"
import { settings } from "../settings.ts";
import { service } from "uneventful/shared";
import { app, plugin } from "../plugin.ts";

const tabEl = /* @__PURE__ */ createDiv("vertical-tab-content")

/** @category Settings UI */
export type Feature<T> = (ctx: T) => unknown;

/** @category Settings UI */
export function applyFeatures<T>(thing: T, ...features: Feature<T>[]) {
    if (features.length) for (const f of features) if (f) f(thing);
    return thing;
}

/** @category Settings UI */
export function settingsBuilder(containerEl: HTMLElement = tabEl) {
    // If we're building stuff at the root of the default container, make sure
    // the settings tab will load and get registered.
    if (containerEl === tabEl) loadSettingsTab()
    return <FieldParent>{
        containerEl: containerEl,
        field(parentEl?: HTMLElement) { return new FieldBuilder(this, parentEl); },
        with(...features: Feature<FieldParent>[]) { return applyFeatures(this, ...features); },
    };
}

/** @category Settings UI */
export function field(): FieldBuilder<SettingsTabBuilder>;
export function field<T extends FieldParent>(owner: T): FieldBuilder<T>;
export function field(owner?: FieldParent) {
    return new FieldBuilder(owner);
}

/** @category Settings UI */
export interface SettingsProvider extends Component {
    showSettings?(component: o.Component): void
}

/** @category Settings UI */
export function useSettingsTab(owner?: SettingsProvider & Partial<Useful>) {
    return settingsTab().addProvider(owner);
}

const loadSettingsTab = /* @__PURE__ */ service(function *() {
    yield *until(settings)
    return settingsTab()
})

const settingsTab = /* @__PURE__ */ service(() => {
    if (!plugin) throw new Error("Plugin not created/registered yet")
    const tab = new SettingsTabBuilder(app, plugin)
    tab.containerEl = tabEl
    settings.rule(() => {
        tab.plugin.addSettingTab(tab)
        rule(() => {
            if (!tab.isOpen()) return;
            const children = Array.from(tab.containerEl.childNodes)
            const c = new o.Component;
            c.load();
            peek(() => tab.providers.forEach(p => p._loaded && p.showSettings(c)));
            return () => { c.unload(); tab.containerEl.setChildrenInPlace(children); }
        });
    })
    return tab
})

/**
 * The Settings Tab class
 *
 * This is mostly an implementation detail; you will generally want to use
 * {@link settingsTab}, {@link useSettingsTab}, {@link field}, and/or
 * {@link group} rather than directly interacting with this.
 *
 * @category Settings UI
 */
export class SettingsTabBuilder extends PluginSettingTab implements Useful, FieldParent {

    plugin = plugin
    use = getContext();

    isOpen = value(false);
    providers: SettingsProvider[] = []

    static "use.me" = settingsTab

    with(...features: Feature<this>[]) { return applyFeatures(this, ...features); }

    clear() { this.containerEl.empty(); return this; }

    field(parentEl=this.containerEl) { return new FieldBuilder<this>(this, parentEl); }

    then(cb: (s: this) => any): this {
        cb(this);
        return this;
    }

    addProvider(provider: SettingsProvider) {
        if (provider?.showSettings && this.providers.indexOf(provider) === -1) this.providers.push(provider);
        return this;
    }

    display() { this.isOpen.set(true); }
    hide()    { this.isOpen.set(false); }
}

/** @category Settings UI */
export interface FieldParent {
    containerEl: HTMLElement
    field(parentEl?: HTMLElement): FieldBuilder<this>
    with(...features: Feature<this>[]): this
}

/** @category Settings UI */
export class FieldBuilder<T extends FieldParent> extends Setting {
    constructor(public builder = settingsBuilder() as T, parentEl = builder.containerEl ) {
        super(parentEl);
    }
    end() {
        return this.builder
    }
    field(parentEl?: HTMLElement): FieldBuilder<T> {
        return this.builder.field(parentEl)
    }
    with(...features: Feature<this>[]) { return applyFeatures(this, ...features); }
}
