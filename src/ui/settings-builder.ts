import { OptionalCleanup, cleanup } from "../cleanups";
import { when } from "../eventful";
import { obsidian as o } from "../obsidian";
import { SettingsService } from "../plugin-settings";
import { Useful, getContext, onLoad, use } from "../services";
import { signal } from "../signify";

export interface SettingsProvider extends o.Component {
    showSettings?(component: o.Component): void
}

export function useSettingsTab<T>(owner: SettingsProvider & Partial<Useful>) {
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
            withParent(this.containerEl, () => { this.providers.forEach(p => p._loaded && p.showSettings(c)); });
            return () => { c.unload(); this.clear(); }
        }));
    }

    clear() { this.containerEl.empty(); return this; }

    field(parentEl=this.containerEl) { return new FieldBuilder(this, parentEl); }

    then(cb: (s: this) => any): this {
        cb(this);
        return this;
    }

    addProvider(provider: SettingsProvider) {
        if (provider.showSettings) this.providers.push(provider);
        return this;
    }

    display() { this.isOpen.set(true); }
    hide()    { this.isOpen.set(false); }
}

interface FieldParent {
    containerEl: HTMLElement
    field(parentEl?: HTMLElement): FieldBuilder<this>
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
}

export var parentElement: HTMLElement;

export function withParent(el: HTMLElement, cb?: () => OptionalCleanup) {
    const old = parentElement;
    try {
        parentElement = el;
        const r = cb?.();
        if (typeof r === "function") cleanup(r);
    } finally {
        parentElement = old;
    }
}
