import { Workspace, WorkspaceParent } from "obsidian";
import { LayoutItem } from "./settings";

type layoutVisitor = (item: LayoutItem) => boolean | void;

/**
 * Walk the entire workspace tree, including the workspace itself, along with all roots, windows,
 * leaves, and splits. (Equivalent to walkLayout(app.workspace, visitor).)  Returns true if the
 * visitor function returned true at any point in the traversal, false otherwise.
 *
 * @param visitor Callback taking a Workspace or WorkspaceItem, can return true to stop the traveral
 */
export function walkLayout(visitor: layoutVisitor): boolean;

/**
 * Walk a portion of the workspace tree, including leafs, splits, roots, windows, etc. if contained
 * under the starting point.  Returns true if the visitor function returned true at any point in the
 * traversal, false otherwise.
 *
 * @param item The workspace or workspace item to begin traversal from
 * @param visitor Callback taking a Workspace or WorkspaceItem, can return true to stop the traveral
 */
export function walkLayout(item: LayoutItem, visitor: layoutVisitor): boolean;

export function walkLayout(item: LayoutItem | layoutVisitor, visitor?: layoutVisitor) {
    if (!item) return false;
    if (typeof item === "function") { visitor = item; item = app.workspace; }
    if (visitor(item)) return true;
    if (item instanceof Workspace) {
        return walkLayout(item.rootSplit, visitor) ||
            walkLayout(item.floatingSplit, visitor) ||
            walkLayout(item.leftSplit, visitor) ||
            walkLayout(item.rightSplit, visitor);
    } else if (item instanceof WorkspaceParent) {
        for (const child of item.children) {
            if (walkLayout(child, visitor)) return true;
        }
    }
    return false;
}

declare module "obsidian" {
    interface WorkspaceParent {
        children: WorkspaceItem[]
    }
    interface Workspace {
        floatingSplit?: WorkspaceParent
    }
}