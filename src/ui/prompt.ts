import { Modal } from "../obsidian";
import { deferred } from "../deferred";

export class Dialog extends Modal {
    buttonContainerEl = this.modalEl.createDiv("modal-button-container");

    onOK: (e: MouseEvent|KeyboardEvent) => any

    constructor() {
        super(app);
        this.containerEl.addClass("mod-confirmation");
    }

    addOKButton(onClick: (e: MouseEvent|KeyboardEvent) => any, text="OK") {
        this.onOK = onClick;
        return this.addButton("mod-cta", text, onClick);
    }

    addButton(cls: string, text: string, onClick: (e: MouseEvent) => void | boolean | PromiseLike<void|boolean>) {
        this.buttonContainerEl.createEl("button", {cls, text}).addEventListener("click", async e => {
            if (!await onClick(e)) this.close();
        });
        return this;
    }

    addCancelButton(callback?: () => any) {
       return this.addButton("", i18next.t("dialogue.button-cancel"), () => (this.close(), callback && callback()));
    }

    setContent(c: string | Node) {
        if (String.isString(c)) this.contentEl.setText(c); else this.containerEl.appendChild(c);
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

export class Prompt extends Dialog {
    value: string | false = false;

    setting = this.contentEl.createDiv("is-mobile"); // hack for reasonable text box
    inputEl = this.setting.createEl("input", {type:"text"}, inputEl => {
        inputEl.addEventListener("keypress", async e => {
            if (e.key === "Enter" && !e.isComposing) { if (!await this.onOK?.(e)) this.close(); }
        })
    });

    setPlaceholder(placeholder?: string) {
        if (placeholder) this.inputEl.placeholder = placeholder; else this.inputEl.removeAttribute("placeholder");
        return this;
    }

    setValue(value: string) {
        this.inputEl.value = value;
        return this;
    }

    prompt(): Promise<string|false> {
        const {resolve, promise} = deferred<string|false>();
        this.addOKButton(() => { this.value = this.inputEl.value; }); // inputEl value XXX
        this.addCancelButton();
        this.onClose = () => resolve(this.value);
        this.open();
        this.inputEl.select();
        this.inputEl.focus();
        return promise;
    }
}
