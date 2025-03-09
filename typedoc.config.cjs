// Ensure we use Windows Git when possibly running under Cygwin
const {TYPEDOC_GIT_DIR, PATH, OS} = process.env;
if (OS==="Windows_NT" && TYPEDOC_GIT_DIR !== undefined) process.env.PATH=`${TYPEDOC_GIT_DIR};${PATH}`;

// @ts-expect-error TS1479 (this is cjs, import is mjs)
/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
    entryPoints: ["./src/index.ts", ],
    router: "structure",
    customCss: ["./typedoc/custom.css"],
    customJs: ["./typedoc/custom.js"],
    categorizeByGroup: false,
    categoryOrder: [
        "Developer's Guide",
        "*",
        "Other"
    ],
    hideGenerator: true,
    excludeInternal: true,
    excludeExternals: true,
    excludePrivate: true,
    excludeProtected: true,
    excludeReferences: true,
    externalSymbolLinkMappings: {
        "uneventful": {
            Configurable: "https://uneventful.js.org/interfaces/uneventful_signals.Configurable.html",
            Connection: "https://uneventful.js.org/types/uneventful.Connection.html",
            isJobActive: "https://uneventful.js.org/functions/uneventful.isJobActive.html",
            Inlet: "https://uneventful.js.org/interfaces/uneventful_signals.Inlet.html",
            Job: "https://uneventful.js.org/interfaces/uneventful.Job.html",
            must: "https://uneventful.js.org/functions/uneventful.must.html",
            peek: "https://uneventful.js.org/functions/uneventful_signals.peek.html",
            root: "https://uneventful.js.org/variables/uneventful.root.html",
            rule: "https://uneventful.js.org/functions/uneventful_signals.rule.html",
            SchedulerFn: "https://uneventful.js.org/types/uneventful_signals.SchedulerFn.html",
            Signal: "https://uneventful.js.org/interfaces/uneventful_signals.Signal.html",
            Sink: "https://uneventful.js.org/types/uneventful.Sink.html",
            "Signal.peek": "https://uneventful.js.org/interfaces/uneventful_signals.Signal.html#peek",
            Throttle: "https://uneventful.js.org/interfaces/uneventful_signals.Throttle.html",
        },
        "to-use": {
            "Useful": "https://github.com/pjeby/to-use?tab=readme-ov-file#useful",
        },
        "obsidian": {
            "View": "https://github.com/search?q=repo%3Aobsidianmd%2Fobsidian-api+%22class+View%22+language%3ATypeScript&type=code",
            "WorkspaceRoot": "https://github.com/search?q=repo%3Aobsidianmd%2Fobsidian-api+%22class+WorkspaceRoot%22+language%3ATypeScript&type=code",
        }
    },
    navigation: {
        includeCategories: true,
        includeFolders: false,
    },
    projectDocuments: ["CHANGELOG.md"],
    sort: [
        "alphabetical"
    ],
    sortEntryPoints: false
};

// Set source links to vscode unless running on GitHub Actions
const {CI, GITHUB_RUN_ID} = process.env;
if (CI === undefined || GITHUB_RUN_ID === undefined) {
    module.exports.sourceLinkTemplate = `vscode://file/${__dirname}/{path}:{line}`;
}
