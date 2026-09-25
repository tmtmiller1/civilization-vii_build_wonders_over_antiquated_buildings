#!/usr/bin/env bash
# install-dev.sh: copy the mod into the game's Mods folder. The game reads copies, not symlinks, so run this
# after every edit and relaunch (or reload the save) to see it.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MODS="$HOME/Library/Application Support/Civilization VII/Mods"
DEST="$MODS/build-wonders-over-antiquated-buildings"
[ -d "$MODS" ] || { echo "Civ VII Mods dir not found: $MODS" >&2; exit 1; }
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$HERE/build-wonders-over-antiquated-buildings.modinfo" "$DEST/"
cp -R "$HERE/ui" "$HERE/lib" "$HERE/text" "$DEST/"
echo "installed -> $DEST  (mod id tower-build-wonders-over-antiquated-buildings)"
echo "NEXT: launch Civ VII, enable 'Build Wonders Over Antiquated Buildings' in Add-Ons, load a game."
