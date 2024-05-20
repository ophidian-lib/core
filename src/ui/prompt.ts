import { deferred } from "../deferred.ts";
import { Dialog } from "./dialog.ts";

/** @category Modals and Dialogs */
export class Prompt extends Dialog {
    value: string | false = false;

    onOK(_) {
        const {value} = this.inputEl;
        if (!this.isValid(value)) {
            this.handleInvalidEntry(value);
            return true; // refuse entry
        }
        this.value = this.inputEl.value;
    }

    isValid(t: string) { return true; }
    handleInvalidEntry(t: string) { return; }

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

    setPattern(pattern: string) {
        this.inputEl.pattern = pattern;
        return this.setValidator(v => new RegExp(`^${pattern}$`).test(v));
    }

    setValidator(isValid: (s: string) => boolean) {
        this.isValid = isValid
        this.inputEl.oninput = () => this.inputEl.setAttribute("aria-invalid", "" + !isValid(this.inputEl.value));
        return this;
    }

    onInvalidEntry(callback: (t: string) => void) {
        this.handleInvalidEntry = callback;
        return this;
    }

    prompt(): Promise<string|false> {
        this.addCancelButton();
        const {resolve, promise} = deferred<string|false>();
        this.onClose = () => resolve(this.value);
        this.open();
        this.inputEl.select();
        this.inputEl.focus();
        return promise;
    }
}
