import { Component, PluginSettingTab, Setting } from "obsidian";
import { obsidian as o } from "../obsidian.ts";
import { SettingsService } from "../plugin-settings.ts";
import { Useful, getContext, onLoad, use, app } from "../services.ts";
import { detached, must } from "uneventful";
import { peek, rule, value } from "uneventful/signals"

/** @category Settings UI */
export type Feature<T> = (ctx: T) => unknown;

/** @category Settings UI */
export function applyFeatures<T>(thing: T, ...features: Feature<T>[]) {
    if (features.length) for (const f of features) if (f) f(thing);
    return thing;
}

/** @category Settings UI */
export function settingsBuilder(containerEl: HTMLElement = useSettingsTab().containerEl) {
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
    return new FieldBuilder(owner || useSettingsTab());
}

/** @category Settings UI */
export interface SettingsProvider extends Component {
    showSettings?(component: o.Component): void
}

/** @category Settings UI */
export function useSettingsTab(owner?: SettingsProvider & Partial<Useful>) {
    return getContext(owner)(SettingsTabBuilder).addProvider(owner) as SettingsTabBuilder;
}

/** @category Settings UI */
export class SettingsTabBuilder extends PluginSettingTab implements Useful, FieldParent {

    plugin = use(o.Plugin)
    use = use.this;

    isOpen = value(false);
    providers: SettingsProvider[] = []

    constructor() {
        super(app, use(o.Plugin));
        this.plugin.register(detached.start(() => {
            must(use(SettingsService).once(() => {
                onLoad(this.plugin, () => this.plugin.addSettingTab(this));
            }));
            rule(() => {
                if (!this.isOpen()) return;
                const c = new o.Component;
                c.load();
                peek(() => this.providers.forEach(p => p._loaded && p.showSettings(c)));
                return () => { c.unload(); this.clear(); }
            });
        }).end);
    }

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
    constructor(public builder: T, parentEl = builder.containerEl ) {
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
