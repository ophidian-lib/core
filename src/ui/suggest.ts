import { obsidian as o } from "../obsidian";
import { defer } from "../defer";
import { deferred } from "../deferred";
import { FuzzySuggestModal } from "obsidian";
import { app } from "../services";

export function modalSelect<T>(
    items: T[],
    format?: (item: T) => string,
    placeholder?: string,
    setup?: (modal: o.FuzzySuggestModal<T>) => any
): Promise<{item: T, event: KeyboardEvent|MouseEvent}> {

    const {resolve, promise} = deferred<{item: T, event: KeyboardEvent|MouseEvent}>();

    const modal = new (class extends FuzzySuggestModal<T> {
        declare scope: o.Scope;

        getItemText(item: T) { return format?.(item) ?? ""+item; }

        getItems() { return items; }

        onChooseItem(item: T, event: KeyboardEvent|MouseEvent) {
            resolve({item, event});
        }

        onClose() {
            super.onClose();
            defer(() => resolve({item: null, event:null}));
        }

    })(app);

    if (placeholder) modal.setPlaceholder(placeholder);
    setup?.(modal);
    modal.open();
    return promise;
}
