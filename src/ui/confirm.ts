import { deferred } from "../deferred.ts";
import { Dialog } from "./dialog.ts";

/** @category Modals and Dialogs */
export class Confirm extends Dialog {
    value: boolean = false;

    onOK(_) {
        this.value = true;
    }

    confirm(): Promise<boolean> {
        this.addCancelButton();
        const {resolve, promise} = deferred<boolean>();
        this.onClose = () => resolve(this.value);
        this.open();
        return promise;
    }
}
