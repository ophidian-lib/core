/**
 * @module @ophidian/core
 */
export * from "./add-ons.ts";
export * from "./cleanups.ts";
export * from "./clone-value.ts";
export * from "./defer.ts";
export * from "./deferred.ts";
export * from "./dom.ts";
export * from "./eventful.ts";
export * from "./indexing.ts";
export * from "./JSON.ts";
export * from "./layout/index.ts";
export * from "./localStorage.ts";
export * from "./plugin-settings.ts";
export * from "./settings.ts";
export * from "./resources.ts";
export * from "./services.ts";
export * from "./signify.ts";
export * from "./ui/index.ts";

// Expose Obsidian's i18n support (type declaration only)
import { i18n } from "i18next";
declare global {
    const i18next: i18n
}

// Export Obsidian itself
export { obsidian as o } from "./obsidian.ts";
