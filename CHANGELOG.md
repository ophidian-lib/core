# Changelog

Note: in versions 0.0.20+, Ophidian was using a combination of @preact/signals-core, Wonka.js, and a lot of custom code to do the things that in it will use [Uneventful](https://uneventful.js.org/) for.  If you are *directly* using anything that's exported from the `src/signify.ts`, `src/eventful.ts`, or `src/cleanups.ts` modules, please be aware that they are almost all being deprecated in favor of Uneventful's equivalent APIs.  Future versions in the 0.0.x range will include backward-compatible wrappers for the bits that don't involve Wonka.js (for which no backward-compatibility will be provided), but from version 0.1.0 on those will be gone.

So, if you're using any APIs from those modules, please see [this Github issue](https://github.com/ophidian-lib/core/issues/3) to get more details, ask questions, or report issues.

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

