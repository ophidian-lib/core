import { Service } from "../services";

/** use() this to make your plugin support Style Settings */
export class StyleSettings extends Service {
    onload() { this.triggerReparse(); }
    onunload() { this.triggerReparse(); }

    triggerReparse() {
        if (app.workspace.layoutReady) app.workspace.trigger("parse-style-settings");
    }
}