export * from "./clone-value";
export * from "./defer";
export * from "./deferred";
export * from "./dom";
export * from "./layout";
export * from "./localStorage";
export * from "./plugin-settings";
export * from "./services";
export * from "./signify";
export * from "./ui";

// Expose Obsidian's i18n support (type declaration only)
import { i18n } from "i18next";
declare global {
    const i18next: i18n
}

// Export Obsidian itself
export { obsidian as o } from "./obsidian";
