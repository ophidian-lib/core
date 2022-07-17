## Ophidian = Component Framework + Build System for Obsidian Plugins

Some [Obsidian](https://obsidian.md) plugins are too big to just slap everything in one class.  But as you break things into smaller parts, you end up doing a lot of hard-to-change and fragile `this.that.theOther.thing`, that also makes the parts less reusable.

In addition, if you develop lots of plugins, you'll find yourself duplicating a bunch of build management and release publishing tools and configuration.

So, Ophidian exists to:

1. Solve the component access problem (mostly via [to-use](https://github.com/pjeby/to-use/)),
2. Provide some commonly-useful services and components for building sophisticated Obsidian plugins, and
3. Provide a complete build system for Obsidian plugins, including [a Github action for publishing them](docs/Publish-Action.md), without needing to duplicate large amounts of code and configuration between plugins.

The framework for items 1 and 2  is designed in modular fashion, so that modern tree-shaking bundlers (like the one Ophidian's build system uses) will only include the components needed for your plugin, not the entire thing.

(Note: if you're not using Ophidian to build your plugins, note that you will need to ensure your bundler will read Typescript from within your `node_modules`, because the component framework is distributed in source form.)

### The Core Framework

As of this release, the core framework features include:

- A service access system for dividing plugins into smaller components that can access each other without relying on `this.that.etc` chains or hardwiring the components to a specific plugin class.  (Implemented as a thin Obsidian-specific wrapper over [to-use](https://github.com/pjeby/to-use/).)
- "Layout Settings" services for storing persistent settings on the Obsidian workspace or specific items in it (windows, leaves, splits, etc.), with full support for Obsidian's workspaces plugin.  (See Pane Relief's "Focus Lock" feature for a simple usage example.)
- Services for managing window-specific UI components (for supporting Obsidian 0.15+'s multi-window feature), now used in Pane Relief and Quick Explorer for extending their UIs to multiple windows.
- Miscellaneous functions for deferring execution, walking the Obsidian workspace component tree, creating delegated event listeners, etc.

### The Build System

See the `ophidian.config.mjs` and `package.json` files in [Pane Relief](https://github.com/pjeby/pane-relief) for a usage example.  For the use of the Github action to publish plugins, see [the documentation](docs/Publish-Action.md) for an example and details.

### Status

This project is still in development and should mostly be considered pre-alpha.  Expect things to move fast (and get broken) between even point releases.  (So your package.json should specify the *exact release* you want, not a `^` or `~`!)

Basically, if a part of this package isn't documented, it's not yet stable.  (And to start with, none of it is documented.  Internal comments and JSDocs don't count!)

Everything in this package is stable enough that they'r being used in my own plugins, but many subsystems are likely to grow new features or experience refactoring, especially in the area of layout.

