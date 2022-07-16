#!/usr/bin/env bash
PLUGIN_NAME=$(jq -r .id manifest.json)
PLUGIN_NAME=${PLUGIN_NAME:-${GITHUB_REPOSITORY##*/}}

TAG_NAME=${GITHUB_REF##*/}
MANIFEST_VERSION=$(jq -r .version manifest.json)

if [[ "$MANIFEST_VERSION" != "$TAG_NAME" ]]; then
    echo "ERROR: Commit is tagged '$TAG_NAME' but manifest version is '$MANIFEST_VERSION'"
    exit 1
fi

pnpm install
pnpm build

rm -f dist/main.css

mkdir "${PLUGIN_NAME}"

assets=()
for f in main.js manifest*.json styles.css; do
    if [[ -f dist/$f ]] && [[ ! -f $f ]]; then
        mv dist/$f $f;
    fi
    if [[ -f $f ]]; then
        cp $f "${PLUGIN_NAME}/"
        assets+=(-a "$f")
    fi
done

zip -r "$PLUGIN_NAME".zip "$PLUGIN_NAME"
hub release create "${assets[@]}" -a "$PLUGIN_NAME".zip -m "$TAG_NAME" -m "### $COMMIT_MESSAGE" "$TAG_NAME"
