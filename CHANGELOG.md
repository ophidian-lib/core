# Changelog

### 0.0.25 (unreleased)

- New settings API: {@link settings}.  (The older APIs are still available, but share their implementation with the new APIs.)  Among other features, automatic transparent support for `onExternalSettingsChange()` has been added, meaning that as long as you're using setting subscriptions your app will automatically apply any new settings when using Obsidian Sync or other tools that update your plugin's `data.json`.
- Added {@link styleSettingsFor}() API to read settings from the Obsidian Style Settings plugin, to ease migration of settings from Style Settings to internal settings.
- Add {@link register `@register`} decorator that lets you run your Obsidian components' `.onload()` methods in an Uneventful job, so you don't have to `this.register(root.start(() => {}).end)` in every component.
- Fixed: the {@link StyleSettings} service will now correctly trigger an update at the right time when Obsidian is starting.
- Fixed: {@link LayoutSetting.onSet}() was passing the wrong arguments to its callback when setting was tied to a specific layout item (via `.of()` or at construction time). If you were relying on this behavior, you may need to add an extra (ignored) initial argument to your callback.
- As of this version, [Uneventful](https://uneventful.js.org/) 0.0.10 is required as a peerDependency, and the old preact/wonka code has been removed.

  Note: in versions 0.0.20 - 0.0.24, Ophidian was using a combination of @preact/signals-core, Wonka.js, and a lot of custom code to do the things that it now uses Uneventful for.  If you were *directly* using anything exported from the `src/signify.ts`, `src/eventful.ts`, or `src/cleanups.ts` modules, please be aware that they are now almost all deprecated in favor of Uneventful's equivalent APIs.  Future versions in the 0.0.x range will include backward-compatible wrappers for the bits that don't involve Wonka.js (for which no backward-compatibility will be provided), but from version 0.1.0 on those will be gone.

  So, if you're using any APIs from those modules, please see [this Github issue](https://github.com/ophidian-lib/core/issues/3) to get more details, ask questions, or report issues.

### 0.0.24

- Use `main` to designate the main module, improving compatibility with older plugin projects that don't use `moduleResolution: node16` yet.  (Fixes an effective regression in 0.0.23)
- Misc. code cleanups, like using the local `app` var instead of the global one, and building the project using `moduleResolution: node16`.

### 0.0.23

- Ophidian is now built pre-packaged as a .js and .d.ts combination, rather than relying on directly importing .ts source files from the npm package.  This means that you no longer have to use ophidian/build in order to process its CSS or other files.
- Upgraded Obsidian API version to 1.3.5

### 0.0.22

- The spawn() API was rolled into job()
- Improved savepoint performance
- Jobs usable as promises
- field() and group() API for building settings UI (status: experimental)
- Toggle and nest setting groups with persistent state

### 0.0.21

- Inlined styles to support tree-shaking (so all Ophidian CSS isn't included in every Ophidian-based plugin).  This change requires the use of ophidian/build, however.
- when() and until() APIs for async operations
- Refcounting framework for shared resources
- "Cleanups" framework
- the() API added
- Experimental signals-based APIs
- Added `app` as an export, as an alternative to using the Obsidian global `app`

