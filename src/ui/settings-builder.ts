import { Component, Plugin, PluginSettingTab, Setting } from "../obsidian";
import { Useful, getContext, onLoad, use } from "../services";

export interface SettingsProvider extends Component {
    showSettings?(builder: SettingsTabBuilder): void
    hideSettings?(builder: SettingsTabBuilder): void
}

export function useSettingsTab(owner: SettingsProvider & Partial<Useful>) {
    return getContext(owner)(SettingsTabBuilder).addProvider(owner);
}

export class SettingsTabBuilder extends PluginSettingTab implements FieldParent {

    constructor() {
        const plugin = use(Plugin);
        super(app, plugin);
        onLoad(plugin, () => plugin.addSettingTab(this));
    }

    clear() { this.containerEl.empty(); return this; }

    field(parentEl=this.containerEl) { return new FieldBuilder(this, parentEl); }

    then(cb: (s: this) => any): this {
        cb(this);
        return this;
    }

    addProvider(provider: SettingsProvider) {
        if (provider.showSettings) {
            this.onDisplay(() => provider._loaded && provider.showSettings(this));
        }
        if (provider.hideSettings) {
            this.onHide(() => provider._loaded && provider.hideSettings(this));
        }
        return this;
    }

    onDisplay(cb?: (s: SettingsTabBuilder) => any){ this.onDispCb = chain(this.onDispCb, cb); }
    onHide(   cb?: (s: SettingsTabBuilder) => any){ this.onHideCb = chain(cb, this.onHideCb); }

    protected onDispCb?: (s: SettingsTabBuilder) => any
    protected onHideCb?: (s: SettingsTabBuilder) => any

    display() { this.onDispCb?.(this); }
    hide()    { if (this.onHideCb) this.onHideCb?.(this); else this.clear(); }
}

interface FieldParent {
    containerEl: HTMLElement
    field(parentEl?: HTMLElement): FieldBuilder<this>
}

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
}

function chain<T>(f1: (v: T) => any, f2: (v: T) => any): (v: T) => void {
    if (!f1) return f2;
    if (!f2) return f1;
    return v => { f1?.(v); f2?.(v); };
}
