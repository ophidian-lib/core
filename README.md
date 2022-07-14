## Ophidian: A Component Framework for Obsidian Plugins

Some [Obsidian](https://obsidian.md) plugins are too big to just slap everything in one class.  But as you break things into smaller parts, you end up doing a lot of hard-to-change and fragile `this.that.theOther.thing`, that also makes the parts less reusable.

This framework exists to 1) solve that problem (mostly via [to-use](https://github.com/pjeby/to-use/)), and 2) provide some commonly-useful services and components for building sophisticated Obsidian plugins.

It is designed in modular fashion, so that modern tree-shaking bundlers (like rollup and esbuild) will only include the components needed for your plugin, not the entire thing.

In addition, Ophidian also includes some tools for building Obsidian plugins, to minimize the amount of duplicated configuration required between plugins when using esbuild or rollup directly.

Note: this library is written and distributed in TypeScript form and can't be `require()`d as a normal node module, because the code in it mostly can't work outside of Obsidian's runtime environment anyway!  So when building a plugin with it, you need to ensure that your bundler will process Typescript from within your `node_modules`.

(If you're using esbuild or ophidian itself as your plugin builder, you probably won't need any special steps for this to work, but the rollup Typescript plugin requires extra configuration to get it to work properly, as does your tsconfig.json.)

### Status

This project is still in development and should mostly be considered pre-alpha.  Expect things to move fast (and get broken) between even point releases.  (So your package.json should specify the *exact release* you want, not a `^` or `~`!)

Basically, if a part of this package isn't documented, it's not yet stable.  (And to start with, none of it is documented.  Internal comments and JSDocs don't count!)

As of this release, there are three sub-modules:

- ` build` for building plugins (see the `ophidian.config.mjs` and `package.json` files in [Pane Relief](https://github.com/pjeby/pane-relief) for a usage example),
- `services` for dividing plugins into smaller components and asking each other -- a thin Obsidian-specific wrapper over [to-use](https://github.com/pjeby/to-use/), and
- `layout` which provides services for storing persistent settings on the Obsidian workspace or specific items in it (windows, leaves, splits, etc.), with full support for Obsidian's workspaces plugin.

You do not need to import items directly from `services` or `layout`, as all of their exports are re-exported by the top-level `ophidian` package.

All of these submodules are stable enough that I've started using them in my own plugins, but the layout package is the one currently most likely to grow new functionality, have bugs, or get its API reworked.

