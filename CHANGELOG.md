# Changelog

All notable changes to Build Wonders Over Antiquated Buildings are documented here. This project follows semantic
versioning. The history of the routes that were tried before this design, and the probe runs behind them, is in
`mod_ideas_tested/build_wonders_over_antiquated_buildings/CHANGELOG-2026-09-24-before-split.md`.

## [0.3.0] - 2026-09-24

The shipped design, moved into `tower_mods/` on its own, brought to the repo's code standard, and watched working
from this folder (runs `pb6`, `pb7`, `pb8` on 1.5.0, 2026-09-24).

- Renamed from "Wonders Over Outdated Buildings" (mod id `tower-wonders-over-outdated-buildings`, script prefix
  `woob`) to "Build Wonders Over Antiquated Buildings" (`tower-build-wonders-over-antiquated-buildings`, `bwab`).
  The rename changed the script's import path, so the end-to-end run has to be repeated from this folder.
- One script, `ui/bwab-clear-and-build.js`: hooks the Wonder placement screen so urban tiles whose buildings are
  all antiquated are offered; choosing one clears the tile (buildings only; walls are never destroyed by the mod
  and are re-created on the Wonder's district), queues the stock Wonder there through the game's own path, and
  hands the displaced citizens to the game's Grow City prompt. Watched end to end on two tiles, one with walls
  (run `pb5`, under the old name): both became real `DISTRICT_WONDER` tiles, population unchanged once placed,
  walls preserved.
- The confirmation text is localised (`LOC_BWAB_CLEAR_*`); it was hardcoded English.
- A kill switch (`globalThis.__bwab.enabled = false`) and an `uninstall()` that restores the engine's own
  `canStart` and `sendRequest`.
- `lib/bwab-eligibility.js`: the tile rule. One antiquated building or several qualifies; one antiquated beside
  one current-age does not; two current-age do not; anything Ageless does not; walls neither block nor count.
- Dev tooling mirroring the Emigration mod: `tsc --noEmit` over JSDoc types, eslint with the shared rule set,
  `npm run verify`.

### Fixed while verifying the rename

- The per-plot acceptance read a cache that only a prior list-the-plots call filled, so a commit that arrived
  without one was refused (`pb8`). The placement screen always lists first, so this never showed in play, but
  nothing guarantees that order. `isInjected` now recomputes on a cache miss.
- The confirmation read `DialogBoxAction.Confirm` as if it were an engine global. It is an export of
  `/core/ui/dialog-box/model-dialog-box.js`; the guarded read was falling through to a hardcoded `1`, which
  happens to be the right value. It is taken off the imported module now.
- The confirmation is raised on a deferred tick. A modal raised from inside the event that asked for it does not
  reliably take input in Civ VII (the same lesson as the Emigration dilemma modal).

### Watched, on this folder's build

- Both cases end as real Wonder districts: two antiquated buildings (`WONDER_BUSEOKSA`), and two plus ANCIENT
  WALLS on a hill (`WONDER_EL_ESCORIAL`), the walls standing on the Wonder district afterwards.
- Population is conserved: Leeds 26 -> 26 (urban 15 -> 13, rural 9 -> 11), Philadelphia 16 -> 16 (urban 6 -> 4,
  rural 10 -> 12), with the displaced points handed to the game's own Grow City screen
  (`INTERFACEMODE_ACQUIRE_TILE`) and `pendingPopulation` back to 0 once placed.
- The confirmation renders natively and its text composes: "Amphitheater and Academy will be cleared to build
  Buseoksa here. You will be asked where the 2 displaced citizens settle." Pressing OK drove the clear.
- Live network multiplayer (`pb18`, a fresh Exploration-age LAN game): Grand Bazaar offered on an antiquated tile,
  cleared and built over the network session, population conserved; a second, competing placement was refused by
  the engine and rolled back intact.
- The Wonder placement screen holds the injected tile: `urbanPlots` contains it and `isPlotIndexSelectable()`
  answers true, with the "Place <Wonder>" panel rendering for it. The game plays its own Wonder completion
  cinematic afterwards.

### Fixed after watching it fail in the engine

- **The mod used to override the engine's refusal of a Wonder.** Its `canStart` wrap answered Success whenever it
  added plots, so a Wonder that was locked, not yet unlocked, or already standing somewhere in the world was still
  offered. Watched (`pb10`): a tile was cleared for a Wonder another civilization had already built, and the city
  lost a building for a Wonder that could never be placed. The wrap now asks the engine first and only answers for
  a refusal that is actually about placement (`LOC_BUILDING_CONSTRUCT_NO_SUITABLE_LOCATION`); every other refusal
  stands. Measured in one city: 2 of 48 Wonders buildable, 42 refused for non-placement reasons, 4 for want of a
  site.
- **A refusal after clearing no longer costs anything.** The engine will not answer about a tile until it is empty,
  and it enforces rules this file cannot read, so a clear can still be followed by a refusal (watched: `pb14`, a
  coastal Wonder on a cleared coastal tile). The mod now asks the engine before adding any citizens and, if the
  answer is no, re-creates the buildings and walls it destroyed.
- **The post-clear check asked the mod's own wrap**, which always agreed with itself. It asks the engine directly
  now.

- **Wonders that must sit next to a district are evaluated now instead of excluded.** `AdjacentDistrict`
  (Grand Bazaar next to an urban district, for instance) is checked against the six neighbours' district types.
  Only lake adjacency and appeal placement are still left unevaluated, and those Wonders are still not offered.

### Changed: the clear and the build happen in one tick

- The three engine requests (each building's destroy, the district's destroy, the BUILD) are sent back to back
  and the outcome is read afterwards, instead of waiting fixed timers between steps. Watched (`pb19` raw, `pb20`
  through the mod): the tile goes from its buildings straight to the Wonder's construction site 146 ms later and
  never reads bare at 50 ms sampling, so no empty hex is drawn; before, empty ground showed for about seven
  seconds. Citizens are added only once the Wonder is standing; a refusal still rolls the tile back, after a
  three-second grace period during which the hex is empty.

### Changed: only tiles the engine would take are offered

- Every placement rule the database holds for a Wonder is now read: invalid adjacent biomes, homeland and
  distant lands join terrain, biome, feature, river, adjacent terrain/district/mountain/constructible and the
  required constructible in the settlement. Rule tables no Wonder uses today exclude a Wonder if one ever does.
- A water tile is offered to a Coast Wonder only when the engine already accepts that Wonder on a bare coast tile
  of the same city. The five Coast Wonders' rules are in the engine alone: Nan Madol was refused on a cleared
  Coast tile that passed every table rule, accepted on no coast tile in eighteen cities, and its Civilopedia
  wording ("adjacent land must be an Island") is not the rule either -- eight tiles beside island land, none
  accepted. The readable parts (adjacent to land, not a Lake, Distant Lands, no Tundra neighbour) are still
  checked. Refusal side watched (`pb25`); a coast Wonder landing on a coastal urban tile is not.

### Known, minor

- A tile the mod adds has no `PlacementPlotData`, so the placement panel's yield-delta lookup for it logs
  `Failed to find PlacementPlotData for plotIndex <n>` and returns nothing. Soft: no throw, the screen opens, the
  tile stays selectable. The player loses the yield preview on that one tile.
