import { Component } from "obsidian";
import defaults from "defaults";

export class LocalObject<T extends {}> extends Component {
    protected defaultJSON: string;

    constructor(
        public readonly key: string,
        defaults: T = {} as T,
        protected onChange?: (v: T) => any  // async callback on load + whenever value changes
    ) {
        super();
        this.defaultJSON = JSON.stringify(defaults);
    }

    get() { return this.parseWithDefaults(localStorage[this.key]); }

    modify<R>(fn: (val: T) => R, leaseTime=1000): Promise<R> {
        return this.withLock(() => {
            const
                oldJSON = localStorage[this.key] ?? "{}",
                obj = this.parseWithDefaults(oldJSON),
                ret = fn(obj),
                newJSON = JSON.stringify(obj)
            ;
            if (newJSON !== oldJSON) {
                localStorage[this.key] = newJSON;
                this._update(obj);
            }
            return ret;
        }, leaseTime);
    }

    unset(): Promise<void> {
        return this.withLock(() => localStorage.removeItem(this.key));
    }

    parseWithDefaults(s: string|null): T {
        return defaults(JSON.parse(s ?? "{}"), JSON.parse(this.defaultJSON));
    }

    async withLock<R>(fn: () => R, leaseTime = 1000): Promise<R> {
        const poll = 50, retry = 100;
        const lockX = this.key+"::lock-X", lockY = this.key+"::lock-Y";
        // Lamport lock: loop until valid lease acquired
        // ( https://www.cs.rochester.edu/research/synchronization/pseudocode/fastlock.html )
        while (true) {
            const id = app.appId + ":" + Math.random() + ":" + (+Date.now() + leaseTime);
            localStorage[lockX] = id;
            const Y = localStorage[lockY];
            if (Y && +(Y.split(":").pop()) > +Date.now()) {
                // An unexpired lease exists; try again after a delay
                await sleep(poll * (Math.random() + 0.5));
            } else {
                localStorage[lockY] = id;
                if (localStorage[lockX] === id) break;
                // Collision: wait for other process to notice and abort
                await sleep(retry * (Math.random() + 0.5));
                if (localStorage[lockY] === id) break;
            }
        }
        try { return fn(); } finally { delete localStorage[lockX]; delete localStorage[lockY]; }
    }

    onload(): void {
        if (!this.onChange) return;
        this._update(this.get());
        this.registerDomEvent(window, "storage", e => {
            if (e.key !== this.key || e.oldValue === e.newValue) return;
            this._update(this.parseWithDefaults(e.newValue));
        });
    }

    protected _update(value: T) {
        Promise.resolve(value).then(this.onChange);
    }
}

declare module "obsidian" {
    interface App {
        appId: string;
    }
}
