import { when } from "../eventful";
import { obsidian as o } from "../obsidian";
import { SettingsService } from "../plugin-settings";
import { Useful, getContext, onLoad, use } from "../services";
import { signal } from "../signify";

export type Feature<T> = (ctx: T) => unknown;

export function applyFeatures<T>(thing: T, ...features: Feature<T>[]) {
    if (features.length) for (const f of features) if (f) f(thing);
    return thing;
}

export function settingsBuilder(containerEl: HTMLElement = useSettingsTab().containerEl) {
    return <FieldParent>{
        containerEl: containerEl,
        field(parentEl?: HTMLElement) { return new FieldBuilder(this, parentEl); },
        with(...features: Feature<FieldParent>[]) { return applyFeatures(this, ...features); },
    };
}

export function field<T extends FieldParent=SettingsTabBuilder>(owner?: T) {
    return new FieldBuilder(owner || useSettingsTab());
}

export interface SettingsProvider extends o.Component {
    showSettings?(component: o.Component): void
}

export function useSettingsTab(owner?: SettingsProvider & Partial<Useful>) {
    return getContext(owner)(SettingsTabBuilder).addProvider(owner) as SettingsTabBuilder;
}

export class SettingsTabBuilder extends o.PluginSettingTab implements Useful, FieldParent {

    plugin = use(o.Plugin)
    use = use.this;

    isOpen = signal(false);
    providers: SettingsProvider[] = []

    constructor() {
        super(app, use(o.Plugin));
        this.plugin.register(use(SettingsService).once(() => {
            onLoad(this.plugin, () => this.plugin.addSettingTab(this));
        }))
        this.plugin.register(when(this.isOpen, () => {
            const c = new o.Component;
            c.load();
            this.providers.forEach(p => p._loaded && p.showSettings(c));
            return () => { c.unload(); this.clear(); }
        }));
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

export interface FieldParent {
    containerEl: HTMLElement
    field(parentEl?: HTMLElement): FieldBuilder<this>
    with(...features: Feature<this>[]): this
}

export class FieldBuilder<T extends FieldParent> extends o.Setting {
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
