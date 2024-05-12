/**
 * This collection of grody hacks makes @knodes/typedoc-plugin-pages 0.23.4 work
 * with Typedoc 0.25.4.
 *
 * First, it monkeypatches the TypeDoc default theme to 1) add navigation menus
 * for the pages inserted by the pages plugin and 2) remove the ugly "namespace
 * Page Title" heading from the generated pages.  (I put my titles in the actual
 * markdown files anyway.)
 *
 * Second, it patches the pages plugin to stick a different "kind" on the
 * pseudo-namespaces it generates so that the heading patch knows what pages to
 * remove the ugly heading from.
 *
 * Third it patches the pages plugin in various ways to make it work properly with
 * `--watch`.
 *
 * And last, but far from least, it runs the `typedoc` CLI!
 *
 * You may be able to reuse this script for your project if you're using a theme
 * that is either the typedoc DefaultTheme or a subclass thereof.  In my case,
 * my navigation is grouped by category, and I wrote the nav generation to merge
 * navigation nodes by name.  That means if I make a page or menu called "Jobs"
 * at the top level, it merges with the "Jobs" category in the nav, and so on
 * recursively, so I can add subpages (markdown) to any (generated) page in the
 * docs.  (If you don't like that approach to the nav, pages, or headings,
 * you'll have more work to do!)
 *
 * Anyway, good luck and enjoy!
 */
import { DeclarationReflection, RendererEvent, UrlMapping, DefaultTheme, NavigationElement, PageEvent, Reflection, ReflectionKind } from "typedoc";
import { around } from "monkey-around";
import { PagesPluginReflectionKind, ANodeReflection, PageReflection } from "@knodes/typedoc-plugin-pages";
import { DefaultPagesRenderer } from "@knodes/typedoc-plugin-pages/dist/output/theme/default-pages-renderer.js";
import { PagesPlugin } from "@knodes/typedoc-plugin-pages/dist/plugin.js";
import { ABasePlugin } from "@knodes/typedoc-pluginutils";

// Patch typedoc DefaultTheme to render menus and drop titles on markdown pages
around(DefaultTheme.prototype, {
    // Merge page navigation with the existing navigation
    buildNavigation(next) {
        return function(project) {
            const typedocNav = next.call(this, project);
            return mergePages(
                project.getReflectionsByKind( PagesPluginReflectionKind.ROOT as any )
                    // XXX Grab + concat children of all roots -- works fine for my
                    // purposes, but is it right for monorepos?
                    .filter((x) : x is ANodeReflection => x instanceof ANodeReflection)
                    .flatMap(n => mapNode(n).children),
                [{text: "API Reference", children: typedocNav }]
            );
        }
    },
    // Patch the render context's `header` template
    getRenderContext(next) {
        return function(pageEvent) {
            const res = next.call(this, pageEvent);
            around(res, {header(next) {
                return function(props) {
                    const res = next.call(this, props);
                    const oldKind = props.model.kind;
                    if (oldKind === PagesPluginReflectionKind.PAGE as any) {
                        res.children.pop()  // strip title
                    }
                    return res;
                }
            }})
            return res;
        }
    },
})

// Patch pages plugin to keep PAGE kind so we can hack the header on those pages
around(DefaultPagesRenderer.prototype as any, {_onRendererBeginPageAlterModel(next) {
    return function(pageEvent: PageEvent<any>) {
        if (pageEvent.model.kind === PagesPluginReflectionKind.PAGE as any) {
            next.call(this, pageEvent);
            pageEvent.model.kind = PagesPluginReflectionKind.PAGE as any;
        } else return next.call(this, pageEvent);
    }
}});

// Patch pages plugin to add URLs on every run (when using --watch)
// Currently it skips doing this after the first run.
//
around(PagesPlugin.prototype as any, {
    _onRendererBegin(next) {
        return function(event: RendererEvent) {
            // On the first run we don't need to do anything
            if (!this._themeMethods) return next.call(this, event);

            // On subsequent runs we need to fix up the pages
            next.call(this, event);

            // This is all stuff in the renderer constructor that should be called on each
            // render begin, not just when it's constructed:
            const self = this._themeMethods;
            self._modulesPages = event.project.getReflectionsByKind(PagesPluginReflectionKind.ROOT as any);
            self._modulesPages.forEach(n => self._mapNode(n));
            self._allPages = event.project.getReflectionsByKind(PagesPluginReflectionKind.PAGE as any).filter(p => !p.kindOf(PagesPluginReflectionKind.ROOT as any));
            event.urls = [
                ...(event.urls ?? []),
                ...self._allPages.map(p => new UrlMapping(p.url, p, self._renderPage.bind(self)))
            ];
        };
    }
});

// Patch pluginutils base to insert root sources every time - workaround the
// `--watch` bug: https://github.com/KnodesCommunity/typedoc-plugins/issues/526
//
let lastInsert = [];
around(ABasePlugin as any, {
    _addSourceToProject(next) {
        return function(context) {
            const before = context.project.sources?.slice() ?? [];
            next.call(this, context);
            const after = context.project.sources?.slice() ?? [];
            if (after.length === before.length) {
                context.project.sources = [...lastInsert, ...before];
            } else {
                lastInsert = after.slice(0, after.length - before.length);
            }
        }
    }
});

// Run typedoc CLI
(() => import("../node_modules/typedoc/dist/lib/cli.js"))();

// ==== Utility Functions ==== //

// Convert pages and menus to typedoc NavigationElements
function mapNode(node: ANodeReflection, parent: Reflection = node.module): NavigationElement {
    const d = new DeclarationReflection(node.name, ReflectionKind.Namespace, parent);
    const el: NavigationElement = {
        text: node.name,
        path: node instanceof PageReflection ? node.url : undefined,
        children: node.childrenNodes?.map( c => mapNode( c, node.isModuleAppendix ? node.module : d ) ),
    }
    if (!el.children?.length) delete el.children;
    return el;
}

// Merge two collections of nav elements, giving pages/menus priority over categories/groups/namespaces/etc.
// Items with the same link text are merged, with props from the page/menu taking precedence.  Children
// are merged recursively following the same algorithm.
function mergePages(pages: NavigationElement[], nodes: NavigationElement[]): NavigationElement[] {
    const merged = new Map<string,NavigationElement>();
    pages.forEach(p => merged.set(p.text, p));
    nodes.forEach(n => {
        if (!merged.has(n.text)) return merged.set(n.text, n);
        const p = merged.get(n.text);
        const m = {...p, ...n, children: mergePages(p.children ?? [], n.children ?? [])};
        if (!m.children?.length) delete(m.children);
        merged.set(n.text, m);
    })
    if (merged.size) return Array.from(merged.values());
}
