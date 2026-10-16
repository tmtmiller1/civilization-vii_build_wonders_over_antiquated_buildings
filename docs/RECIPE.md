# The shipped design and the runs behind it

Build Wonders Over Antiquated Buildings works end to end with no data change at all. The runs on 1.5.0,
2026-09-24: `pb5` under the mod's old name, then `pb6`, `pb7` and `pb8` against this folder after the rename.
`pb6` drove it through the mod's own hooks exactly as a player's click drives them, through the confirmation
the mod had at the time (removed since: placing is one click now, `pb8-nodialog`); `pb7` read and photographed
the Wonder placement screen; `pb8` committed without listing first (the case that found the cache fix below),
placed the displaced citizens through the game's own Grow City screen, and photographed the finished tiles.

```
T1  plot 2780  ["BUILDING_AMPHITHEATER","BUILDING_ACADEMY"]                 both Antiquity, DISTRICT_URBAN
      listed by the placement screen  accepted at the plot  cleared  built
      -> DISTRICT_WONDER ["WONDER_BUSEOKSA"]          pop 26 -> 26   pendingPopulation 2 (the player's prompt)

T2  plot 3912  ["BUILDING_BLACKSMITH","BUILDING_ACADEMY","BUILDING_ANCIENT_WALLS"]   hill
      cleared: walls went with the district; re-created on the Wonder's district when it landed
      -> DISTRICT_WONDER ["WONDER_EL_ESCORIAL","BUILDING_ANCIENT_WALLS"]   pop 16 -> 16   walls PRESERVED
```

Real, stock, class-`WONDER` Wonders. Their uniqueness, their cinematics, their terrain rules, the adjacency bonus
their neighbors read from `DISTRICT_WONDER`, and everything the AI does are untouched, because nothing about
Wonders is touched. The mod clears the tile and lets the game build on it.

---

## What the player does

Pick a Wonder in production. Urban tiles whose buildings are all antiquated now show as valid sites alongside the
usual ones. Choose one, as you would an empty tile; the mod adds no prompt of its own. The tile is cleared, the
Wonder is queued there, and the game's own Grow City prompt asks you to place each displaced citizen (rural tile or
specialist seat, wherever you like) before the turn can end.

## What qualifies: the rule (`lib/bwab-eligibility.js`, 36 tests)

| Tile holds | Offered |
|---|---|
| one antiquated building, free slot or not | yes |
| two (or more) antiquated buildings | yes |
| one antiquated beside one current-age | no |
| two current-age | no |
| anything Ageless (Palace, City Hall, Harbor, unique-quarter buildings, Wonders) | no |
| walls, alongside any of the above | walls neither block nor count; they are kept |

Antiquated = previous age and not `AGELESS`. The engine itself enforces none of this (it offers every
terrain-valid urban tile whatever stands on it), so this rule is the only thing that decides what is ever cleared.
The Options screen can make it stricter: "From two ages back" (`agesBack: 2`) counts a building only when its age is
two or more places before the current one in `Ages.ChronologyIndex` order, and refuses the rest as `has-too-recent`.
That and the master switch are in [OPTIONS.md](OPTIONS.md); neither has been watched in a game yet.

The Wonder's own placement rules are checked in script before a tile is offered for it: terrain, biome, no-feature
(`NoFeature` against the tile's feature), river, adjacent terrain, adjacent district, adjacent mountain, adjacent
constructible, invalid adjacent biomes, homeland or distant lands, and the required constructible in the settlement.
The rest are read but not evaluated, and a Wonder that has one is left out before any tile is looked at
(`unreadRule` in `lib/bwab-eligibility.js`, tested): lake adjacency (`AdjacentLake`), appeal placement
(`RequiresAppealPlacement`), river placement (`RiverPlacement`), `Wonders.BuildOnFrontier`, any feature table
(`Constructible_ValidFeatures`, `_RequiredFeatures`, `_RequiredFeatureClasses`, `_InvalidFeatures`) and
`Constructible_ValidResources`. `wonderFitsTile` also leaves out every Wonder with `Wonders.AdjacentToLand` or
`MustBeLake`, treating both as marks of a water Wonder.

These rows were read on 2026-10-15 from compiled gameplay databases, the engine's own record of what it loaded:

| Copy | Game | Wonders loaded |
|---|---|---|
| `~/.tower-bench/runs/2026-10-15T19-07-19/gameplay-copy-usualset-antiquity-seed4242-20261015-150736.sqlite` | 1.5.0 Antiquity, every DLC and the 16 Tower mods, 2026-10-15 | 27 |
| `firaxis-bug-reports/repro/runs/g1-A-vanilla/gameplay-copy.sqlite` | Exploration, the dev machine's DLC and one test mod with no Wonder rows, 2026-10-09 | 50 |
| `other_peoples_mods_analysis/_debug-db/gameplay-copy.sqlite` | Modern, mod set not recorded, 2026-10-12 | 71 |

An Antiquity game loads only the 27 Antiquity Wonders, so the later ones come from the two older copies. Every row
below matches the 1.5.0 XML in `civilization_vii_1.5.0_game_files/` too. In the two ages when a tile can be
antiquated, the mod leaves out:

| Wonder | Age | Source | Rule |
|---|---|---|---|
| Shwedagon Zedi Daw | Exploration | Base | `AdjacentLake` |
| Rila Monastery | Exploration | DLC `bulgaria` | `Wonders.BuildOnFrontier` ("Cannot be placed adjacent to a District") |
| Hale o Keawe | Exploration | Base | `Wonders.AdjacentToLand`, a Coast Wonder |
| Havana Harbor | Exploration | DLC `pirate-republic` | `Wonders.AdjacentToLand` and `MustNotBeLake`, a Coast Wonder |
| Muzibu Azaala Mpanga | Modern | Base | `AdjacentLake` |
| Ubudiah Mosque | Modern | DLC `asia-wonders` | `Constructible_RequiredFeatureClasses` = `FEATURE_CLASS_WET` ("Must be placed on Wet Terrain") |
| Statue of Liberty | Modern | Base | `RiverPlacement="ANCHORED"`, and it's a Coast Wonder anyway |
| Battersea Power Station | Modern | DLC `great-britain` | `Wonders.AdjacentToLand` on a land Wonder (`AdjacentTerrain` = `TERRAIN_COAST`) |

Vix (DLC `gaul`) also carries `BuildOnFrontier`, but it's an Antiquity Wonder, when nothing is antiquated yet.
Battersea Power Station was missing from the earlier reading of the XML: it's a land Wonder, and the `AdjacentToLand`
line has left it out since 0.3.0. No Wonder in any of the three copies has `Constructible_ValidFeatures`,
`_RequiredFeatures`, `_InvalidFeatures`, `NoFeature`, `RequiresAppealPlacement` or a resource row, so those checks
don't leave any Wonder out today.

No Tower mod in the usual set changes a Wonder's placement. The 27 Antiquity Wonders' rows in `Constructibles`,
`Wonders` and the nine `Constructible_*` placement tables (99 rows) are identical in the usual-set copy and the
Exploration one, and none of the 16 mods' data files names a Wonder or writes to the `Wonders` table.

The coast Wonders' rules are the engine's alone, so the engine is asked. Nan Madol was refused on a cleared Coast
tile that satisfied every table rule (`pb14`); a survey of every coast tile in all eighteen cities (`pb22`) found
the engine accepting it nowhere; and its Civilopedia wording ("Coast adjacent to land, this land must be an
Island") is not the engine's rule either: eight coast tiles beside island land were accepted on none (`pb24`),
while every city center in that empire is off-island. So for a water tile the gate is empirical. The Wonder must
already be accepted by the engine on at least one bare coast tile of the same city, which shows its hidden rules
can be met there, and the tile must pass the readable ones (adjacent to land; not a Lake where `MustNotBeLake`;
Distant Lands and no Tundra neighbor where the data says so). In `pb25` the Lighthouse tile is not offered to Nan
Madol, which the engine accepts nowhere, while the two land tiles still build. A coast Wonder actually landing on
a coastal urban tile needs a game where the engine accepts it somewhere, and no run has had one.

Six Wonders have a `TERRAIN_COAST` row: the Colossus and the Great Lighthouse (Antiquity), Hale o Keawe, Havana
Harbor and Nan Madol (Exploration), and the Statue of Liberty (Modern). Of the four you can build while a tile is
antiquated, only Nan Madol reaches this gate. The other three are in the table above, two for `AdjacentToLand` and
the Statue for `RiverPlacement`. The README and the Workshop draft used to speak of "the five Coast Wonders" as all
going through it.

## How it works, step by step

| Step | Call | Run |
|---|---|---|
| the placement screen offers the tile | wrap `Game.CityOperations.canStart(BUILD)`; for a WONDER, append eligible plots to `Plots` | `pb5` |
| the commit path accepts it | wrap the per-plot `canStart(BUILD, {X, Y})` for an injected plot | `pb5` |
| the clear | `DESTROY_ELEMENT {Kind:"CONSTRUCTIBLE"}` per building (never a wall), then `{Kind:"DISTRICT"}`, then the BUILD, all in one tick | `pb1`, `pb2`, `pb3`, `pb5`, `pb19`, `pb20` |
| the plot is ordinary land | takes a rural point, a building, and a stock Wonder | `pb2`, `pb3` |
| the build | forward the original `sendRequest(BUILD, {X, Y})` in the same tick as the clear; the tile reads Wonder 146 ms later with no bare state in between | `pb3`, `pb5`, `pb19`, `pb20` |
| the citizens | `city.addRuralPopulation(1)` per point destroyed; the game's Grow City prompt does the rest | `pj10`, `pb5` |
| the walls | the district takes them down; `CREATE_ELEMENT {Kind:"CONSTRUCTIBLE", Type, Location, Owner}` puts them back on the Wonder district when it lands (walls are valid on `DISTRICT_WONDER` in shipped data) | `pb5`, `pb6` |
| the placement screen highlights the tile | `BuildingPlacementManager` pushes every plot of the `canStart` result into `urbanPlots`, and `isPlotIndexSelectable(ourPlot)` (the test a click makes) answers true | `pb7` |
| no prompt of the mod's own | the commit the placement screen sends goes straight to the clear and the build; the confirmation `pb6` photographed was removed | `pb8-nodialog` |
| the displaced citizens reach the player's own screen | `INTERFACEMODE_ACQUIRE_TILE` with `panel-place-population` in the DOM, the game's Grow City placement screen, holding the points the clear created; placing them took `pendingPopulation` to 0 | `pb8` |
| a player's own click drives all of it | a human clicked the hex (and the confirmation the mod had then); the clear followed from that click | `pb14` |
| one antiquated building beside a free slot (case B) | the same clear with one destroy instead of two; population conserved | `pb14`, `pb15` |
| a refusal costs nothing | the engine refused the cleared plot, and the buildings and district were put back | `pb15` |
| a live network game | a fresh Exploration-age LAN session: Grand Bazaar offered on an antiquated tile, cleared and built to `DISTRICT_WONDER` over the network, population conserved; a competing placement was refused (one per player) and rolled back intact | `pb18` |

The runs live in `mod_ideas_tested/build_wonders_over_antiquated_buildings/devtools/harness/` as `<label>-UI.log`.

## What it costs

The tile. Two buildings' worth of yields and maintenance are gone and the tile holds the Wonder from then on. The
citizens are not lost (the head count is unchanged once they are placed) but the city has fewer building slots.

## What the run showed, exactly

`pb6`, on the two tiles, through the mod's own hooks:

```
T1  plot 2780  Amphitheater + Academy          -> WONDER_BUSEOKSA   DISTRICT_WONDER
      pop 26 -> 26   urban 15 -> 13   rural 9 -> 11   specialists 2 -> 2   2 citizens pending
T2  plot 3912  Blacksmith + Academy + WALLS    -> WONDER_EL_ESCORIAL DISTRICT_WONDER + BUILDING_ANCIENT_WALLS
      pop 16 -> 16   urban 6 -> 4     rural 10 -> 12  walls PRESERVED
```

Population is conserved: the citizens the cleared buildings housed come back as points the player places. The game
played its own Wonder completion cinematic ("New Wonder - BUSEOKSA - Leeds, 1050 CE"), which is the engine
treating it as the ordinary Wonder it is.

## The order the screen asks in, and why it no longer matters

The placement screen lists a Wonder's plots (`canStart` with no `X`/`Y`) before it commits one (`canStart` with
them), so the mod's per-plot answer was read from the list it had just computed. `pb8` committed without listing
first and was refused: nothing guarantees that order, and a refusal there would deny a build the player was
allowed to make. `isInjected` now recomputes on a cache miss instead of answering no, and `pb8` then ran through.

## What the mod may and may not decide

This mod decides *where* a Wonder may go, not *whether* one may be built. The engine refuses a Wonder for reasons
that have nothing to do with any tile (locked, not yet unlocked, already standing somewhere in the world), and
those refusals are left alone. In one city (`pb11`): 2 of 48 Wonders buildable, 42 refused with no stated reason,
and 4 refused with exactly `LOC_BUILDING_CONSTRUCT_NO_SUITABLE_LOCATION`. Only that last refusal means "nowhere to
put it", and only it is this mod's business.

Before that distinction existed, a tile was cleared for a Wonder another civilization had already built, and the
city lost a building for a Wonder that could never be placed (`pb10`).

## The clear is reversible, because the engine cannot be asked in advance

The engine will not say whether a Wonder fits a tile until the tile is empty, and it enforces rules that are not in
the database tables a mod can read. In `pb14` every readable rule passed (the tile really was `TERRAIN_COAST`,
the only terrain `WONDER_NAN_MADOL` accepts) and the engine still refused the cleared plot. A player's Lighthouse
went with it.

So the clear is judged after the fact: every destroy and the BUILD go to the engine in one tick, the mod then
reads the tile, and only if the Wonder is standing are the displaced citizens added. If the engine refused the
Wonder, the mod re-creates the buildings and walls it destroyed. In `pb15` and `pb20` the tile came back as
`DISTRICT_URBAN` holding its Lighthouse, with population, urban and rural counts unchanged and nothing pending.

## Nothing bare is ever drawn

The three requests (each building's destroy, the district's destroy, the BUILD) are sent back to back in one
tick. Raw (`pb19`) and through the mod's own path (`pb20`), sampling the tile every 50 ms, it reads
`DISTRICT_URBAN` with its buildings at one sample and `DISTRICT_WONDER` with the Wonder at the next (146 ms after
the request), and no sample ever reads a bare tile. The simulation never holds an empty hex, so the screen never
shows one; the buildings are replaced by the Wonder's construction site directly. With the earlier fixed waits
between the steps, empty ground was on screen for about seven seconds.

The one time bare ground would be drawn is a refusal: the mod learns the engine said no only by the Wonder's
absence, so it waits three seconds before restoring the tile (`pb20`, 75 ms to 3.6 s). With water tiles no longer
offered, no refusal has come up; the rollback stays as the backstop for a rule nobody has met yet.

## The yield preview

A plot the mod injects has no `PlacementPlotData` of its own, because the engine computes that only for the plots
it would have offered, so the placement screen used to show no yields for our tile and log an error (`pb6`, `pb7`).
The mod now answers `getPlacementPlotData` for its own plots, building the entry from the engine's own
per-constructible numbers: the Wonder's base yields, minus the yields of the buildings that would go, plus the
maintenance they would stop costing. In `pb12` that read Gold -4, Happiness +1.66 on a Lighthouse tile, with the
hex and the panel both showing it.

It is a first-order figure: yields a Wonder grants conditionally, and adjacency the old buildings were receiving,
are not modeled. No Wonder in the game has adjacency rows of its own (0 of 48), which is why the Wonder side of it
is exact.

Two smaller things worth knowing, both probe-side rather than mod-side: the Wonder completion cinematic is modal
and blocks camera work until `.cinematic-moment__close-button` is pressed, and `UI.Player.selectCity()` switches
interface mode asynchronously, so a `switchTo` issued in the same tick is clobbered (that is what made `pb6`
report the placement screen as empty; `pb7`, with a wait between them, read it correctly).

## What is still open

Case B, the player's own click, a refusal costing nothing, a live LAN game and two people placing at once are all
covered (`pb14`, `pb15`, `pb18`). In `pb18` the probe and the player each committed Grand Bazaar within six seconds;
the engine took the first and refused the second, and the rollback restored the second tile. (The mod had a
confirmation of its own at the time, which a probe flag had skipped; both are gone now.) What is left:

- A coast Wonder actually landing on a coastal urban tile. The gate needs the engine to accept that Wonder on
  some bare coast tile of the city first; no save to hand has one.
- Whether any tile is ever refused now. If one is, the cost is the three-second empty hex, not a lost building.
- Rila Monastery left out for `BuildOnFrontier`, built 2026-10-15 and covered by a test only. Leaving a Wonder out
  can't cost a building, so it went in before a lab run. In an Exploration game with Rila Monastery unlocked, its
  placement screen should show only the game's own sites.
- Lake adjacency (Shwedagon Zedi Daw, Muzibu Azaala Mpanga), not built. It's worth building only if the engine's
  `AdjacentLake` test is "one of the six neighbours reads `GameplayMap.isLake`". The lab check that could prove that
  wrong is below.
- Ubudiah Mosque's wet feature, not built, because the data can't say whether an urban tile ever holds one. Five of
  the six `FEATURE_CLASS_WET` features (Mangrove, Marsh, Oasis, Tundra Bog, Watering Hole) are `Removable` and
  `AllowSettlement`; the sixth, Zhangjiajie, is an impassable natural wonder that never holds a district.
  `District_RemovedFeatures` is empty in the 1.5.0 XML and in the compiled copy, and the only building with a feature
  rule is the Canals mod's own Canal on `FEATURE_CANALS_SITE`, which that mod clears in script. So the data doesn't
  say either way whether a feature survives a tile turning urban; the engine decides, and no run has read a feature
  on an urban tile. The lab check is below.
- The two options and the eleven translations, built 2026-10-15 and covered offline only. The lab checks are listed
  at the end of [OPTIONS.md](OPTIONS.md).

### Lab check: lake adjacency

The guess is that the engine's `AdjacentLake` means "a lake on one of the six neighbours", read the way
`neighbours()` reads them (`GameplayMap.getAdjacentPlotLocation(loc, dir)` for `dir` 0 to 5) and tested with
`GameplayMap.isLake`. A lake is a `TERRAIN_COAST` tile that `isLake` answers true for. The game doesn't have a lake
terrain, so `isLake` is the only thing telling it from sea.

1. Muzibu Azaala Mpanga, Modern age, unlocked by `NODE_CIVIC_MO_MAIN_NATURAL_HISTORY` (or Buganda's
   `NODE_CIVIC_MO_BUGANDA_NNALUBAALE`). Its only placement rule is `AdjacentLake`. As a control, use World's Fair
   (`NODE_CIVIC_MO_MAIN_HEGEMONY`) or the Manhattan Project (`NODE_TECH_MO_NUCLEAR_FISSION`), which don't have any
   placement rule. Both must be unlocked and built nowhere; grant the nodes in the lab if the game hasn't reached them.
2. Find a city with a lake in reach: for each of the local player's cities, walk `city.getPurchasedPlots()` and each
   plot's six neighbours, and keep the cities where some neighbour reads `isLake`. If no city has a lake nearby, pick
   another seed.
3. Set `globalThis.__bwab.enabled = false`, so `Game.CityOperations.canStart` answers as the engine alone. For each of
   the two Wonders, call `canStart(cityID, CityOperationTypes.BUILD, { ConstructibleType: <the row's $index> }, false)`
   and take its `Plots` and `ExpandUrbanPlots`. Set `enabled` back to `true` afterwards.
4. Filter the control's sites to those with an `isLake` neighbour. The guess holds if that set equals Muzibu Azaala
   Mpanga's sites. Any Muzibu site without a lake neighbour, or any filtered control site missing from Muzibu's list,
   proves it wrong; write down which tile and what its neighbours hold (a lake tile with a Fishing Quay on it, a
   one-tile lake, a navigable river running into the lake).
5. Shwedagon Zedi Daw, Exploration age, unlocked by `NODE_TECH_EX_EDUCATION`. Every Exploration Wonder has some
   placement rule, so check it half-way: every site the engine lists has an `isLake` neighbour, and a flat tile with a
   lake neighbour that Erdene Zuu (`TERRAIN_FLAT` only) is offered is offered to Shwedagon Zedi Daw too.

If both hold, add `lake` to what `neighbours()` reads, refuse in `fitsNeighbours` when `def.AdjacentLake` and no
neighbour is a lake, take `AdjacentLake` out of `unreadRule`, and move the two Wonders out of the table above.

### Lab check: a wet feature on an urban tile

1. A quick first read in any game: walk every city's `getPurchasedPlots()`, keep the plots whose district is
   `DISTRICT_URBAN`, and print any that reads a feature at all with `GameplayMap.getFeatureType`.
2. If none does, find a Marsh or an Oasis inside a city's borders (`getFeatureType` against `FEATURE_MARSH` and
   `FEATURE_OASIS` over `getPurchasedPlots()`), build any building on it so the tile turns urban, and read the feature
   again once it stands.

A wet feature still on the tile means such a tile can exist, and Ubudiah Mosque then needs one more check: that the
engine accepts it on a bare wet tile after the district is cleared. If the feature's gone, the engine clears it on
building, an antiquated tile can never qualify for Ubudiah Mosque, and leaving it out doesn't cost the player
anything.

## The two designs this replaced

Kept in `mod_ideas_tested/build_wonders_over_antiquated_buildings/archive/convert-wonders/` with their findings.
Route A (give a WONDER an urban placement row): the Wonder is *added* beside the old buildings, never built over
them. Route E (convert Wonders to `FULL_TILE` buildings): works, but Wonders stop being unique and the AI builds
dozens. Both were the engine telling us the same thing from two sides: overbuild is a building-class mechanic, and
a Wonder has to be placed on bare land.
