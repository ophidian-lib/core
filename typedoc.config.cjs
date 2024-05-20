// Ensure we use Windows Git when possibly running under Cygwin
const {TYPEDOC_GIT_DIR, PATH, OS} = process.env;
if (OS==="Windows_NT" && TYPEDOC_GIT_DIR !== undefined) process.env.PATH=`${TYPEDOC_GIT_DIR};${PATH}`;

/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
    entryPoints: ["./src/index.ts", ],
    customCss: ["./typedoc/custom.css"],
    categorizeByGroup: false,
    categoryOrder: [
        "*",
        "Other"
    ],
    hideGenerator: true,
    excludeInternal: true,
    excludeExternals: true,
    excludePrivate: true,
    excludeProtected: true,
    excludeReferences: true,
    hideParameterTypesInTitle: false,
    navigation: {
        includeCategories: true,
        includeFolders: false,
    },
    options: "package.json", // workaround for https://github.com/KnodesCommunity/typedoc-plugins/issues/525
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
