## Publishing Plugins with the Ophidian Github Action

The Ophidian Publish action makes updating your plugins on Github easy, even if you don't use Ophidian as a library or to build your plugin.  Its features include:

- Automatically checking your manifest (or manifest-beta) version against the tag to make sure they match
- Automatically converting your most recent commit message to (markdown) notes on the release
- Using the newer of manifest.json or manifest-beta.json for the actual release, so you can release the beta generally just by pushing a new manifest.json in your repo.
- The built deliverables (main.js and styles.css) can live in the repo root, or a `dist/` or `build/` subdirectory
- A .zip file with the entire plugin is included in each release, for people to easily download and install the entire plugin if they need a specific version

And, perhaps the best part, it keeps your plugin action scripts short and sweet, e.g.:

```yaml
name: Publish plugin
on:
  push:  # Sequence of patterns matched against refs/tags
    tags:
      - "*" # Push events to matching any tag format, i.e. 1.0, 20.15.10
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: pjeby/ophidian@0.0.6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          release-notes: ${{ github.event.commits[0].message }}

```

### Usage Requirements

Aside from having a `.github/workflows/publish.yml` file like the above example, your plugin must have a build command that can be run via your package manager `build` command.  It should place the built main.js and styles.css (if applicable) in the repository root, or else `dist/` or `build/`.  Files in the root take precedence over files found elsewhere; `manifest.json` (and `manifest-beta.json` if applicable) must always be in the repository root since Obsidian (and BRAT) look for them there.

If you have a manifest-beta.json, Ophidian will publish it in place of manifest.json, if it contains a higher version number.  Whichever version is chosen must exactly match the tag you pushed (with `git push --tags`) to deploy the new version, or the action will fail with an error.

### Configuration

The action supports the following configuration variables, which you may need to change from the simple arrangment shown above:

- `token` - should be set as shown, it will be used to generate the release, upload files, and create release notes
- `release-notes` should be set to what you want included in the release notes.  Set as shown in the example unless you need something special.  The first line of the string will be converted to an H3 heading (by adding `###` and a space in front of it).
- `package-manager` should be set to `pnpm`, `npm` or `yarn` to match your package lockfile (`pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`).  This is the command that will be used to run the `install` and `build` scripts for your plugin.
- `node-version` can be set if you need a specific node.js version to run your builder; Ophidian targets Node 14 by default.
- `pnpm-version` can be set if you need a specific version of pnpm.  (The default is the latest version that supports Node 14.)

(Note: I am using this action mainly with pnpm; if you experience problems using npm or yarn, feel free to file an issue, ideally referencing the repo and/or branch that's giving you trouble so I can attempt to reproduce the problem.)