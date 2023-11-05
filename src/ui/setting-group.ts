import { OptionalCleanup, cleanup } from "../cleanups";
import { LocalObject } from "../localStorage";
import { obsidian as o } from "../obsidian";
import { Service, the } from "../services";
import { computed, effect, signal } from "../signify";
import { parentElement, withParent } from "./settings-builder";
import groupStyle from "scss:./setting-group.scss";

export function field(cb?: (s: o.Setting) => OptionalCleanup) {
    return new GroupField(parentElement)["then"](s => {
        if (cb) {
            const r = cb(s);
            if (typeof r === "function") cleanup(r);
        }
    });
}

export function group(cb?: (g: SettingGroup) => OptionalCleanup) {
    return new SettingGroup(parentElement).build(cb);
}

export class GroupField extends o.Setting {
    constructor(public parentEl: HTMLElement, public parentGroup?: SettingGroup) {
        super(parentEl);
    }

    protected owner = this.parentGroup;

    end() { return this.parentGroup; }

    build(cb?: (g: this) => OptionalCleanup) {
        if (cb) withParent(this.parentEl, cb.bind(null, this));
        return this;
    }

    field(cb?: (s: GroupField) => OptionalCleanup) {
        return new GroupField(this.parentEl, this.owner).build(cb);
    }

    group(cb?: (g: SettingGroup) => OptionalCleanup) {
        return new SettingGroup(this.parentEl, this.owner).build(cb);
    }
}

export class SettingGroup extends GroupField {
    owner = this;
    detailsEl: HTMLDetailsElement;

    constructor(public containerEl: HTMLElement, parentGroup?: SettingGroup) {
        const detailsEl = containerEl.createEl("details", "ophidian-settings-group");
        const summaryEl = detailsEl.createEl("summary", "ophidian-settings-group");
        super(summaryEl, parentGroup);
        this.setHeading();
        this.parentEl = (this.detailsEl = detailsEl).createDiv();
        if (!parentGroup && !containerEl.parentElement.matchParent("details.ophidian-settings-group")) {
            detailsEl.createEl("style", {text: groupStyle});
        }
        // prevent closing group on click
        this.controlEl.addEventListener("click", e => e.preventDefault());
    }

    empty() { this.parentEl.empty(); }

    open(open=true) { this.detailsEl.open = open; return this; }

    keepState(id: string, open: boolean) {
        const details = this.detailsEl, state = the(GroupState);
        effect(() => { details.open = state.get(id, open); });
        details.addEventListener("toggle", () => state.set(id, details.open));
        return this;
    }
}

type GroupToggles = Record<string,boolean>;

export class GroupState extends Service {
    storage: LocalObject<GroupToggles> = new LocalObject(
        `${app.appId}-${this.use(o.Plugin).manifest.id}:setting-group-toggles`, {} as GroupToggles, v => this.data.set(v)
    );
    data = signal(this.storage.get());

    get(key: string, dflt = false) { return computed(() => this.data()[key] ?? dflt)(); }
    set(key: string, value: boolean) { return this.storage.modify(v => { v[key] = value; }); }
}
