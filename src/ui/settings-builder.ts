import { Plugin, PluginSettingTab, Setting } from "../obsidian";
import { onLoad } from "../services";

export interface PluginWithSettingsTab extends Plugin {
    showSettings?(builder: SettingsTabBuilder): void
    hideSettings?(builder: SettingsTabBuilder): void
}

export function settingsTab(plugin: PluginWithSettingsTab) {
    return new SettingsTabBuilder(plugin);
}

export class SettingsTabBuilder extends PluginSettingTab implements FieldParent {

    constructor(plugin: PluginWithSettingsTab) {
        super(app, plugin);
        onLoad(plugin, () => plugin.addSettingTab(this));
        if (plugin.showSettings) {
            this.onDisplay(() => plugin.showSettings(this));
            if (!plugin.hideSettings) {
                this.onHide(() => this.clear());
            }
        }
        if (plugin.hideSettings) {
            this.onHide(() => plugin.hideSettings(this));
        }
    }

    clear() { this.containerEl.empty(); }

    field(parentEl=this.containerEl) { return new FieldBuilder(this, parentEl); }

    then(cb: (s: this) => any): this {
        cb(this);
        return this;
    }

    onDisplay(cb?: (s: SettingsTabBuilder) => any){ this.onDispCb = chain(this.onDispCb, cb); }
    onHide(   cb?: (s: SettingsTabBuilder) => any){ this.onHideCb = chain(this.onHideCb, cb); }

    protected onDispCb?: (s: SettingsTabBuilder) => any
    protected onHideCb?: (s: SettingsTabBuilder) => any

    display() { this.onDispCb?.(this); }
    hide()    { this.onHideCb?.(this); }
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
