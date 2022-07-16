#!/usr/bin/env bash
PLUGIN_NAME=$(jq -r .id manifest.json)
PLUGIN_NAME=${PLUGIN_NAME:-${GITHUB_REPOSITORY##*/}}

TAG_NAME=${GITHUB_REF##*/}
MANIFEST_VERSION=$(jq -r .version manifest.json)
MANIFEST_FILE=manifest.json

BUILD_DIR=dist
if [[ -d build && ! -d dist ]]; then
    BUILD_DIR=build
fi

# Check if beta manifest is newer: if so, use that for the release
# (so betas can be made public later and have the right version number)
#
if [[ -f manifest-beta.json ]]; then
    BETA_VERSION=$(jq -r .version manifest-beta.json)
    if jq --arg v1 "$BETA_VERSION" --arg v2 "$MANIFEST_VERSION" -ne '($v1|split(".")) > ($v2|split("."))' >/dev/null; then
        MANIFEST_VERSION="$BETA_VERSION"
        MANIFEST_FILE=manifest-beta.json
        cp manifest-beta.json manifest.json
    fi
fi

if [[ "$MANIFEST_VERSION" != "$TAG_NAME" ]]; then
    echo "ERROR: Commit is tagged '$TAG_NAME' but $MANIFEST_FILE version is '$MANIFEST_VERSION'"
    exit 1
fi

pnpm install
pnpm build

mkdir "${PLUGIN_NAME}"

assets=()
for f in main.js manifest.json styles.css; do
    if [[ "$f" != manifest.json && -f "$BUILD_DIR/$f" && ! -f "$f" ]]; then
        mv "$BUILD_DIR"/$f $f;
    fi
    if [[ -f $f ]]; then
        cp $f "${PLUGIN_NAME}/"
        assets+=(-a "$f")
    fi
done

zip -r "$PLUGIN_NAME".zip "$PLUGIN_NAME"
hub release create "${assets[@]}" -a "$PLUGIN_NAME".zip -m "$TAG_NAME" -m "### $COMMIT_MESSAGE" "$TAG_NAME"
