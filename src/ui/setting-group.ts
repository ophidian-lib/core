import { Setting } from "obsidian";
import { LocalObject } from "../localStorage.ts";
import { obsidian as o } from "../obsidian.ts";
import { Service, the, app } from "../services.ts";
import { cached, rule, value } from "uneventful/signals";
import { Feature, applyFeatures, FieldBuilder, FieldParent, useSettingsTab, SettingsTabBuilder } from "./settings-builder.ts";
import groupStyle from "scss:./setting-group.scss";

/** @category Settings UI */
export function group(): SettingGroup<SettingsTabBuilder>
export function group<T extends FieldParent>(owner: T): SettingGroup<T>
export function group(owner?: FieldParent) {
    return new SettingGroup(owner || useSettingsTab());
}

/** @category Settings UI */
class SettingGroup<T extends FieldParent> extends Setting implements FieldParent {

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

/** @category Settings UI */
export function trackOpen(id: string, open=false) {
    return <T extends FieldParent>(g: SettingGroup<T>) => {
        const details = g.detailsEl, state = the(SettingGroupState);
        rule(() => { details.open = state.get(id, open); });
        details.addEventListener("toggle", () => state.set(id, details.open));
    }
}

type GroupToggles = Record<string,boolean>;

/** @category Settings UI */
export class SettingGroupState extends Service {
    storage: LocalObject<GroupToggles> = new LocalObject(
        `${app.appId}-${this.use(o.Plugin).manifest.id}:setting-group-toggles`, {} as GroupToggles, v => this.data.set(v)
    );
    data = value(this.storage.get());

    get(key: string, dflt = false) { return cached(() => this.data()[key] ?? dflt)(); }
    set(key: string, value: boolean) { return this.storage.modify(v => { v[key] = value; }); }
}
