export * from "./services";
export * from "./layout";
export * from "./defer";
export * from "./dom";
export * from "./ui";

// These exports use CSS and must be explicitly exported to
// avoid including the CSS even when they aren't used.
//
export {Confirm} from "./ui/confirm";
export {Dialog} from "./ui/dialog";
export {Prompt} from "./ui/prompt";

// Expose Obsidian's i18n support (type declaration only)
import { i18n } from "i18next";
declare global {
    const i18next: i18n
}

// Export Obsidian itself
export * as o from "./obsidian";
