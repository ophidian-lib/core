## A Component Framework for Obsidian Plugins

Some [Obsidian](https://obsidian.md) plugins are too big to just slap everything in one class.  But as you break things into smaller parts, you end up doing a lot of hard-to-change and fragile `this.that.theOther.thing`, that also makes the parts less reusable.

Or, you could use @ophidian/core.

The Ophidian core library solves the component access problem by making it easy for components to reference one another by what kind of thing they want, rather than depending on their specific relationships with other things.  These universally-accessible components are called *services*, and they're accessed via the [to-use](https://github.com/pjeby/to-use/) service container.

In addition, the library also includes a variety of components and functions that are commonly useful for making advanced Obsidian plugins:

- Services for managing window-specific UI components (for supporting Obsidian 0.15+'s multi-window feature), now used in Pane Relief and Quick Explorer for extending their UIs to multiple windows.
- "Layout Settings" services for storing persistent settings on the Obsidian workspace or specific items in it (windows, leaves, splits, etc.), with full support for Obsidian's workspaces plugin.  (See Pane Relief's "Focus Lock" feature for a simple usage example.)
- Miscellaneous functions for deferring execution, walking the Obsidian workspace component tree, creating delegated event listeners, etc.

(And it also works well with [@ophidian/build](https://github.com/ophidian-lib/build) - a complete toolkit for actually *building* and *publishing* your Obsidian plugins, complete with Github Actions.)

### Using The Framework

This project is still in development and changes quickly.   Make sure your plugin's package.json specifies the *exact release* you want (without  a `^` or `~`), so that it won't be broken by incompatible changes before the 1.0.0 release.

Basic example:

```typescript
import {use, PerWindowComponent} from "@ophidian/core";
import {Plugin} from "obsidian";

class ClickDetector extends PerWindowComponent {
    onload() {
        const mainArea = this.win.document.body.find(".mod-root");
        this.registerDomEvent(mainArea, "mousedown", this.onClick);
    }
    onClick = () => {
        const source = this.win === window ? "the main" : "a popout";
        console.log(`you clicked in ${source} window's main area`);
    }
}

export default class extends Plugin {
    // create a use() method
    use = use.plugin(this);

    // get a window manager for ClickDetctor instances, and have it
    // watch for windows being opened and closed
    clicker = this.use(ClickDetector).watch();

    onload() {
        this.addCommand({
            id:"fake-click",
            name:"Pretend to click",
            callback: () => this.clicker.forWindow(activeWindow).onClick()
        });
    }
}
```

This example plugin will load a ClickDetector object for each open window, and monitor click events in the main area of all windows (including the main).  It also showcases how to look up an instance for a particular window.

The Ophidian core framework wraps the  [to-use](https://github.com/pjeby/to-use/) service container, exporting all of its functions and types, but with a few Obsidian-specific twists:

- `use.plugin(pluginThis)` - needed to create a `.use()` method on your plugin
- `Service` -- a class you can subclass to create a "service": an Obsidian `Component` that can be looked up with `.use()` and will load and unload correctly with the plugin

So, if you want to split parts of your plugin into separate components, you can just make `Service` subclasses, and then `.use()` them from your plugin.

Now, so far, this is not much different from using `plugin.addChild(new SomeService(plugin))`, other than having fewer steps and less involved code.  But where the fun really kicks off is that services can `.use()` *each other*, without needing to go through the plugin or depend on the plugin's attributes.  And there will only ever be one instance of a given service class per plugin, even if two unrelated other services depend on it.

In the example above, there is actually a behind-the-scenes service in use: a `WindowManager<ClickDetector>` service is actually created and saved on the plugin as `this.clicker`, so the command can look up the click detector for a specific window.  The WindowManager is doing all the work of loading and unloading click detectors as windows are opened and closed, or when the plugin unloads.

However, we didn't *have to* create that window manager on the plugin itself.  We could have moved all the click detection-related code to another service entirely, and had it create the clicker.  We could also have had the command call `this.use(ClickDetector).forWindow()` in order to look up the window manager on the fly, creating a detector just for the current window if needed.  Or if another service created the window manager in `watch()` mode, the click detector instance would be shared between those services.

Absolutely *none* of that is easy -- and most isn't even possible -- without Ophidian.  You would have to decide what part of your plugin will "own" subcomponents like that, and *every* part needs to know who that owner is and how to get to it.  Everything has to change if you change your mind, and none of the code is reusable across plugins.

With Ophidian, you can just `.use()` service classes, without even needing to pass them a plugin instance, let alone doing the needed load/unload logic or deciding where a singleton service instance "should go" -- you just reference them where they're needed.  They don't even have to be attributes, unless you want them created when the using service or plugin is initialized.  You can just `.use()` them on-demand, unless they need to be loaded before they can be used.

### Project Status

At the moment, the code other than the core services functionality is undocumented and mostly in flux.  The window manager is fairly stable, but not documented other than in the section above.  Be sure to depend on exact versions, or be prepared to deal with possibly backward-incompatible changes!

### About the Name

The word "ophidian" roughly means "like a snake", and Ophidian certainly coils around my Obsidian plugin projects like a snake, building and publishing them while also devouring their tastiest, most reusable bits to make them part of itself.  (Also, you can think of the "ph" in Ophidian as standing for "plugin help" that replaces all the repetitive "bs" in Obsidian plugin development.)  Last, but far from least, the name was available on npm and my other ideas weren't!

