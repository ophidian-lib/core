import { LocalObject } from "../localStorage";
import { obsidian as o } from "../obsidian";
import { Service, the } from "../services";
import { computed, effect, signal } from "../signify";
import { Feature, applyFeatures, FieldBuilder, FieldParent, useSettingsTab, SettingsTabBuilder } from "./settings-builder";
import groupStyle from "scss:./setting-group.scss";

export function group(): SettingGroup<SettingsTabBuilder>
export function group<T extends FieldParent>(owner: T): SettingGroup<T>
export function group(owner?: FieldParent) {
    return new SettingGroup(owner || useSettingsTab());
}

class SettingGroup<T extends FieldParent> extends o.Setting implements FieldParent {

    readonly detailsEl: HTMLDetailsElement;

    constructor(readonly parent?: T, public containerEl: HTMLElement = (<FieldParent>parent || useSettingsTab()).containerEl) {
        const detailsEl = containerEl.createEl("details", "ophidian-settings-group");
        const summaryEl = detailsEl.createEl("summary", "ophidian-settings-group");
        super(summaryEl);
        this.setHeading();
        this.containerEl = (this.detailsEl = detailsEl).createDiv();
        if (!containerEl.parentElement.matchParent("details.ophidian-settings-group")) {
            detailsEl.createEl("style", {text: groupStyle});
        }
        // prevent closing group on click
        this.controlEl.addEventListener("click", e => e.preventDefault());
    }

    with(...features: Feature<this>[]) { return applyFeatures(this, ...features); }
    field(): FieldBuilder<this> { return new FieldBuilder(this); }
    group(): SettingGroup<this> { return new SettingGroup(this); }
    end() { return this.parent; }

    empty() { this.containerEl.empty(); return this; }

    open(open=true) { this.detailsEl.open = open; return this; }
}

export function trackOpen(id: string, open=false) {
    return <T extends FieldParent>(g: SettingGroup<T>) => {
        const details = g.detailsEl, state = the(SettingGroupState);
        effect(() => { details.open = state.get(id, open); });
        details.addEventListener("toggle", () => state.set(id, details.open));
    }
}

type GroupToggles = Record<string,boolean>;

export class SettingGroupState extends Service {
    storage: LocalObject<GroupToggles> = new LocalObject(
        `${app.appId}-${this.use(o.Plugin).manifest.id}:setting-group-toggles`, {} as GroupToggles, v => this.data.set(v)
    );
    data = signal(this.storage.get());

    get(key: string, dflt = false) { return computed(() => this.data()[key] ?? dflt)(); }
    set(key: string, value: boolean) { return this.storage.modify(v => { v[key] = value; }); }
}
