export * from "./services";
export * from "./layout";
export * from "./defer";
export * from "./dom";
export * from "./ui";

// Expose Obsidian's i18n support (type declaration only)
import { i18n } from "i18next";
declare global {
    const i18next: i18n
}

// Export Obsidian itself
export * as o from "./obsidian";