import { Modal } from "../obsidian";
import "./dialog.scss";

export class Dialog extends Modal {
    buttonContainerEl = this.modalEl.createDiv("modal-button-container");
    textContentEl = this.contentEl.createDiv("dialog-text");
    okButton = this.buttonContainerEl.createEl(
        "button", {cls: "mod-cta", text:i18next.t("dialogue.button-continue")}, b => {
        b.addEventListener("click", async (e) => {
            if (!await this.onOK?.(e)) this.close();
        });
    });

    onOK(e: MouseEvent|KeyboardEvent): boolean|void|undefined {
        return false;
    }

    constructor() {
        super(app);
        this.containerEl.addClass("mod-confirmation");
        this.containerEl.addClass("ophidian-dialog");
    }

    setOk(text: string) {
        this.okButton.textContent = text;
    }

    addButton(cls: string, text: string, onClick: (e: MouseEvent) => void | boolean | PromiseLike<void|boolean>, setup?: (button)=>void) {
        this.buttonContainerEl.createEl("button", {cls, text}, setup).addEventListener("click", async e => {
            if (!await onClick(e)) this.close();
        });
        return this;
    }

    addCancelButton(callback?: () => any) {
       return this.addButton("", i18next.t("dialogue.button-cancel"), () => (this.close(), callback && callback()));
    }

    setContent(c: string | Node) {
        if (String.isString(c)) this.textContentEl.setText(c); else this.textContentEl.appendChild(c);
        return this;
    }

    setTitle(title: string) {
        this.titleEl.setText(title);
        return this;
    }

    setup(callback: (modal: this) => any) {
        callback && callback(this);
        return this;
    }

}
