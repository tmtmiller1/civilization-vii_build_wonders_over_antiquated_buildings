#!/usr/bin/env bash
# release.sh: produce the release zip and the Steam Workshop manifest for Build Wonders Over Antiquated Buildings.
#
# Usage:  ./release.sh
# Output: dist/build-wonders-over-antiquated-buildings-vX.Y.Z.zip   (X.Y.Z from the modinfo <Version>)
#         dist/preview.png                                            (1024x1024, from docs/logo.svg; set by hand on
#                                                                      the Workshop page, never sent by steamcmd)
#         dist/workshop_item.vdf                                      (steamcmd manifest, no previewfile)
#
# What it does: run the quality gate (`npm run release:gate`), mirror the shipped files into dist/<folder>/, syntax-check
# the JS, zip with the modinfo at the zip root, audit the zip against an allow-list, render the preview, and write
# the manifest. The change note comes from CHANGELOG.steam.txt (scripts/steam-changelog.mjs keeps it in step with
# CHANGELOG.md). The Workshop description is included only for the FIRST upload (no steam_workshop_id.txt yet) or
# when WITH_DESCRIPTION=1: steamcmd only touches the fields present, so leaving it out keeps the live page text.

set -euo pipefail
cd "$(dirname "$0")"

MODINFO="build-wonders-over-antiquated-buildings.modinfo"
MOD_DIR="build-wonders-over-antiquated-buildings"   # zip root / content folder (the deployed folder name)
TITLE="Build Wonders Over Antiquated Buildings"
APPID="1295660"
DIST_DIR="dist"

[ -f "$MODINFO" ] || { echo "error: $MODINFO not found in $(pwd)"; exit 1; }

VERSION="$(grep -oE '<Version>[^<]+</Version>' "$MODINFO" | head -1 | sed -E 's|</?Version>||g')"
[ -n "$VERSION" ] || { echo "error: could not parse <Version> from $MODINFO"; exit 1; }
AUTHORS="$(grep -oE '<Authors>[^<]+</Authors>' "$MODINFO" | head -1 | sed -E 's|</?Authors>||g')"
case "$AUTHORS" in ""|"Your Name"|"TODO") echo "error: set <Authors> in $MODINFO before packaging."; exit 1;; esac
case "$VERSION" in *-dev|*-smoke|0.0.*) echo "error: <Version> '$VERSION' looks like a dev tag."; exit 1;; esac

# The script's own version string must match the modinfo.
grep -q "version: \"$VERSION\"" ui/bwab-clear-and-build.js \
    || { echo "error: ui/bwab-clear-and-build.js does not carry version \"$VERSION\"."; exit 1; }

if [ "${SKIP_VERIFY:-0}" != "1" ]; then
    # This folder has no node_modules of its own; the dev tooling is shared with the Emigration mod.
    export PATH="$PWD/node_modules/.bin:$PWD/../emigration/node_modules/.bin:$PATH"
    echo "==> Running verify gate (npm run release:gate; SKIP_VERIFY=1 to skip)"
    npm run release:gate
fi

# Steam publishedfileid, kept outside dist/ so it survives `rm -rf dist`. Absent until the first upload.
WORKSHOP_ID_FILE="steam_workshop_id.txt"
PUBLISHED_FILE_ID=""
[ -f "$WORKSHOP_ID_FILE" ] && PUBLISHED_FILE_ID="$(tr -dc '0-9' < "$WORKSHOP_ID_FILE")"

ZIP_NAME="${MOD_DIR}-v${VERSION}.zip"
TARGET_DIR="$DIST_DIR/$MOD_DIR"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

echo "==> Cleaning $DIST_DIR/"
rm -rf "$DIST_DIR"
mkdir -p "$TARGET_DIR"

echo "==> Mirroring the shipped files -> $TARGET_DIR/"
rsync -a --exclude='.git' --exclude='.gitignore' --exclude='.DS_Store' --exclude='dist' --exclude='node_modules' \
    --exclude='release.sh' --exclude='install-dev.sh' --exclude='scripts' --exclude='devtools' --exclude='docs' \
    --exclude='gallery' --exclude='tests' --exclude='types' --exclude='tsconfig.json' --exclude='eslint.config.js' \
    --exclude='package.json' --exclude='package-lock.json' --exclude='README.pdf' --exclude='CHANGELOG.steam.txt' \
    --exclude='steam_workshop_id.txt' --exclude='*.bak' --exclude='coverage' \
    ./ "$TARGET_DIR"/

echo "==> Syntax-checking dist JS"
find "$TARGET_DIR" -name '*.js' -type f -print0 | xargs -0 -n1 node -c

echo "==> Verifying modinfo at zip root"
[ -f "$TARGET_DIR/$MODINFO" ] || { echo "error: $TARGET_DIR/$MODINFO missing"; exit 1; }

echo "==> Zipping $ZIP_PATH"
( cd "$DIST_DIR" && zip -qr "$ZIP_NAME" "$MOD_DIR" )

echo "==> Verifying zip contents against allow-list"
ALLOW="^${MOD_DIR}/(${MODINFO//./\\.}|README\\.md|LICENSE|CHANGELOG\\.md)$"
ALLOW="$ALLOW"'|^'"$MOD_DIR"'/(ui|lib)/[a-z0-9-]+\.js$'
ALLOW="$ALLOW"'|^'"$MOD_DIR"'/text/[a-z_]+/ModText\.xml$'
UNEXPECTED="$(unzip -Z1 "$ZIP_PATH" | grep -vE '/$' | grep -vE "$ALLOW" || true)"
if [ -n "$UNEXPECTED" ]; then
    echo "error: zip contains entries not on the allow-list:"; echo "$UNEXPECTED" | sed 's/^/    /'
    echo "  -> tighten rsync --exclude, or update ALLOW in release.sh if intended."; exit 1
fi
echo "    OK: every shipped entry matches the allow-list."
unzip -l "$ZIP_PATH" | head -25 || true

# ── Steam Workshop preview + manifest ─────────────────────────────────────
PREVIEW_OUT="$DIST_DIR/preview.png"
if command -v rsvg-convert >/dev/null 2>&1 && [ -f docs/logo.svg ]; then
    rsvg-convert -w 1024 -h 1024 docs/logo.svg -o "$PREVIEW_OUT"
    echo "==> Workshop preview rendered: $PREVIEW_OUT (from docs/logo.svg)"
elif [ -f docs/logo.png ]; then
    cp docs/logo.png "$PREVIEW_OUT"
    echo "==> Workshop preview copied: $PREVIEW_OUT (docs/logo.png; brew install librsvg to render the SVG)"
fi

ABS_CONTENT="$(cd "$TARGET_DIR" && pwd)"

# Change note: VDF-safe (no straight double quotes, no backslashes); a hand-edited block is kept.
CHANGENOTE="$(node scripts/steam-changelog.mjs note "$VERSION")" \
    || { echo "error: could not build the Steam change note (see above)"; exit 1; }

# Description: docs/steam-workshop-description.txt, under Steam's 8000-character cap, with straight quotes swapped
# for curly ones because steamcmd's KeyValues parser has no escape for a literal double quote.
DESC_SRC="docs/steam-workshop-description.txt"
DESCRIPTION=""
if [ -z "$PUBLISHED_FILE_ID" ] || [ "${WITH_DESCRIPTION:-0}" = "1" ]; then
    [ -f "$DESC_SRC" ] || { echo "error: $DESC_SRC missing"; exit 1; }
    DESCRIPTION="$(sed -E "s/\\\\/\\\\\\\\/g; s/'/’/g; s/\"([^\"]*)\"/“\\1”/g" "$DESC_SRC")"
    DESC_LEN="$(printf '%s' "$DESCRIPTION" | wc -c | tr -d ' ')"
    [ "$DESC_LEN" -le 8000 ] || { echo "error: description is $DESC_LEN bytes; Steam rejects more than 8000."; exit 1; }
fi

# No previewfile on purpose: Steam rejects a preview sent through workshop_build_item. Set it on the web page.
VDF="$DIST_DIR/workshop_item.vdf"
{
    echo '"workshopitem"'; echo '{'
    echo "    \"appid\"          \"$APPID\""
    [ -n "$PUBLISHED_FILE_ID" ] && echo "    \"publishedfileid\" \"$PUBLISHED_FILE_ID\""
    echo "    \"contentfolder\"  \"$ABS_CONTENT\""
    echo "    \"visibility\"     \"0\""
    echo "    \"title\"          \"$TITLE\""
    [ -n "$DESCRIPTION" ] && printf '    "description"    "%s"\n' "$DESCRIPTION"
    echo "    \"changenote\"     \"${CHANGENOTE}\""
    echo '}'
} > "$VDF"

echo ""
echo "Release built:  $ZIP_PATH  ($(du -h "$ZIP_PATH" | cut -f1))"
echo "  Version: $VERSION   Authors: $AUTHORS   Manifest: $VDF"
if [ -n "$PUBLISHED_FILE_ID" ]; then
    echo "  UPDATE mode: publishedfileid $PUBLISHED_FILE_ID"
    [ -n "$DESCRIPTION" ] && echo "  (description included: WITH_DESCRIPTION=1)"
else
    echo "  NEW-ITEM mode: the first upload mints a publishedfileid; save it so later runs update the same item:"
    echo "     echo <publishedfileid> > steam_workshop_id.txt"
fi
echo ""
echo "-- Upload (SteamCMD; test the cached login first with +@NoPromptForPassword 1 +login tmtmiller +quit) --"
echo "  ~/steamcmd/steamcmd.sh +@NoPromptForPassword 1 +login tmtmiller +workshop_build_item $(cd "$DIST_DIR" && pwd)/workshop_item.vdf +quit"
echo "  Then set the preview image on the Workshop page by hand from $PREVIEW_OUT."
