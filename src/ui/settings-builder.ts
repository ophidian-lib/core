import { obsidian as o } from "../obsidian";
import { SettingsService } from "../plugin-settings";
import { Useful, getContext, onLoad, use } from "../services";

export interface SettingsProvider extends o.Component {
    showSettings?(component: o.Component): void
}

export function useSettingsTab<T>(owner: SettingsProvider & Partial<Useful>) {
    return getContext(owner)(SettingsTabBuilder).addProvider(owner) as SettingsTabBuilder;
}

export class SettingsTabBuilder extends o.PluginSettingTab implements Useful, FieldParent {

    plugin = use(o.Plugin)
    use = use.this;

    c: o.Component;

    constructor() {
        super(app, use(o.Plugin));
        this.plugin.register(use(SettingsService).once(() => {
            onLoad(this.plugin, () => this.plugin.addSettingTab(this));
        }))
    }

    clear() { this.containerEl.empty(); return this; }

    field(parentEl=this.containerEl) { return new FieldBuilder(this, parentEl); }

    then(cb: (s: this) => any): this {
        cb(this);
        return this;
    }

    addProvider(provider: SettingsProvider) {
        if (provider.showSettings) {
            this.onDisplay(c => provider._loaded && provider.showSettings(c));
        }
        return this;
    }

    onDisplay(cb?: (s: o.Component) => any){ this.onDispCb = chain(this.onDispCb, cb); }

    protected onDispCb?: (s: o.Component) => any

    display() { this.c = new o.Component; this.c.load(); this.onDispCb?.(this.c); }
    hide()    { this.c.unload(); this.clear(); }
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

function chain<T>(f1: (v: T) => any, f2: (v: T) => any): (v: T) => void {
    if (!f1) return f2;
    if (!f2) return f1;
    return v => { f1?.(v); f2?.(v); };
}
