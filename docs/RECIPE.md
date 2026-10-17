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

## What qualifies: the rule (`lib/bwab-eligibility.js`, 45 tests)

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
That and the master switch are in [OPTIONS.md](OPTIONS.md); both were watched in a game on 2026-10-15.

Every placement rule a Wonder carries is evaluated per tile by `fitsPlacement` in `lib/bwab-eligibility.js`
(tested rule by rule in `tests/eligibility.mjs`), from what `siteOf` in the UI script reads off the map:

| Rule | Read as |
|---|---|
| `Constructible_ValidTerrains`, `_ValidBiomes` | the tile's terrain and biome are listed |
| `NoFeature`, `Constructible_ValidFeatures`, `_RequiredFeatures`, `_InvalidFeatures` | the tile's `FeatureType` |
| `Constructible_RequiredFeatureClasses` (Ubudiah Mosque, `FEATURE_CLASS_WET`) | the feature's `FeatureClassType` |
| `Constructible_ValidResources` | the tile's `ResourceType` |
| `AdjacentRiver`, `NoRiver` | `GameplayMap.isRiver` |
| `RiverPlacement` | `RIVER`: a river tile. `ANCHORED` and `OFF_COAST`: water beside land (the Statue of Liberty) |
| `MustBeLake`, `MustNotBeLake` | `GameplayMap.isLake` on the tile |
| `RequiresHomeland`, `RequiresDistantLands` | `isDistantLands` |
| `AdjacentTerrain`, `AdjacentDistrict`, `Constructible_InvalidAdjacentBiomes` | the six neighbours |
| `AdjacentLake` (Shwedagon Zedi Daw, Muzibu Azaala Mpanga) | a neighbour reads `isLake` |
| `AdjacentToMountain`, `AdjacentConstructible`, `AdjacentCapital`, `AdjacentResource` | the six neighbours |
| `BuildOnFrontier` (Rila Monastery, Vix) | no neighbour in an `URBAN`, `CITYCENTER` or `WONDER` district |
| `AdjacentToLand` (Battersea Power Station and the coast Wonders) | water: `isAdjacentToLand`. Land: a land neighbour |
| `RequiredConstructibleInSettlement(Count)` | the settlement's constructibles |

`RequiresAppealPlacement` is the one column not evaluated. No Wonder carries it, and one that did would be refused
every tile rather than guessed at.

The frontier reading comes from the game's own text for the other constructible with `BuildOnFrontier`: the
Monastery "must be placed on an existing Improvement, and cannot be placed adjacent to a District". An Improvement
stands on a rural tile, usually among other rural tiles, so a rural tile can't be what "a District" means there. The
Festival Grounds text says the same from the other side ("an existing Improvement ... adjacent to a District"). The
classes are one constant, `FRONTIER_DISTRICT_CLASSES`; `pb27` checks it against the engine.

A water tile is also put to the engine (`engineAcceptsOnWater`), because the coast Wonders keep rules of their own.

These rows were read on 2026-10-15 from compiled gameplay databases, the engine's own record of what it loaded:

| Copy | Game | Wonders loaded |
|---|---|---|
| `~/.tower-bench/runs/2026-10-15T19-07-19/gameplay-copy-usualset-antiquity-seed4242-20261015-150736.sqlite` | 1.5.0 Antiquity, every DLC and the 16 Tower mods, 2026-10-15 | 27 |
| `firaxis-bug-reports/repro/runs/g1-A-vanilla/gameplay-copy.sqlite` | Exploration, the dev machine's DLC and one test mod with no Wonder rows, 2026-10-09 | 50 |
| `other_peoples_mods_analysis/_debug-db/gameplay-copy.sqlite` | Modern, mod set not recorded, 2026-10-12 | 71 |

An Antiquity game loads only the 27 Antiquity Wonders, so the later ones come from the two older copies. Every row
below matches the 1.5.0 XML in `civilization_vii_1.5.0_game_files/` too. These are the Wonders you can build while a
tile is antiquated whose rules go beyond terrain and neighbours, and which needed reading the map more closely:

| Wonder | Age | Source | Rule |
|---|---|---|---|
| Shwedagon Zedi Daw | Exploration | Base | `AdjacentLake` |
| Rila Monastery | Exploration | DLC `bulgaria` | `Wonders.BuildOnFrontier` ("Cannot be placed adjacent to a District") |
| Hale o Keawe | Exploration | Base | `Wonders.AdjacentToLand`, a Coast Wonder |
| Havana Harbor | Exploration | DLC `pirate-republic` | `Wonders.AdjacentToLand` and `MustNotBeLake`, a Coast Wonder |
| Muzibu Azaala Mpanga | Modern | Base | `AdjacentLake` |
| Ubudiah Mosque | Modern | DLC `asia-wonders` | `Constructible_RequiredFeatureClasses` = `FEATURE_CLASS_WET` ("Must be placed on Wet Terrain") |
| Statue of Liberty | Modern | Base | `RiverPlacement="ANCHORED"`, a Coast Wonder |
| Battersea Power Station | Modern | DLC `great-britain` | `Wonders.AdjacentToLand` on a land Wonder (`AdjacentTerrain` = `TERRAIN_COAST`) |

Vix (DLC `gaul`) also carries `BuildOnFrontier`, but it's an Antiquity Wonder, when nothing is antiquated yet. No
Wonder in any of the three copies has `Constructible_ValidFeatures`, `_RequiredFeatures`, `_InvalidFeatures`,
`NoFeature`, `RequiresAppealPlacement` or a resource row.

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
- Every Wonder rule evaluated per tile, compared with the engine on 2026-10-17 (`pb27`, lab games on Exploration and
  Modern seed 4242, and the harness on AugustusExp66 with the live 1.1.1). The script first counted canStart's
  `MountainPlots` as sites; that list is the same for every constructible, a refused one included, so it's left out
  now. Candidates are every bare tile the city owns plus every tile a Wonder of the age is offered, and the plain
  buildings of the age (water ones with RiverPlacement ANCHORED included).

  | Game | Subjects reached | Compared | Mismatches |
  | --- | --- | --- | --- |
  | Exploration 4242, turn 11 | 4 of 4 | 108 | 8 |
  | Modern 4242, turn 7 | 4 of 4 | 116 | 7 |
  | AugustusExp66, turn 68 | 3 of 4 | 1785 | 84 |

  Every engine-no / rules-yes mismatch is a tile with a resource or a mountain:
  - Exploration: 62,23 (flat, rural, Rainforest, Ivory, a lake beside it): Shwedagon and Rila. 59,24 (flat, rural,
    Sugar, river): Rila. Mountains 63,22 (Volcano, two lakes beside it), 59,23 (a lake beside it), 58,25: Shwedagon
    and Rila.
  - Modern: 65,25 (flat, rural, Mangrove, Rice, coast beside it): Ubudiah and Battersea. 65,23 (flat, rural,
    Rainforest, Spices, two lakes beside it): Muzibu and Battersea. 64,26 (coast, rural, Fish): Statue of Liberty.
    Mountain 63,22 (Volcano): Muzibu and Battersea.
  - AugustusExp66: Rila 33 resource tiles and 29 mountains, Shwedagon 13 and 5.

  Taking the Ivory off 62,23 made the engine accept Shwedagon, Rila and Buseoksa there; taking the Rice off 65,25 did
  the same for Ubudiah and Battersea; putting each back refused them again. So the engine refuses a Wonder on any tile
  with a resource, and the rules only read `Constructible_ValidResources`. Neither gap reaches a tile the mod offers
  now: no urban tile on either map held a resource, no open building was offered a resource tile, and a mountain is
  never urban. It would matter only if a resource ever appeared under an urban tile.

  One mismatch the other way, AugustusExp66: the engine took Rila Monastery on four tiles whose only district
  neighbours are rural and a Wonder (90,29 hill; 85,17 flat on the coast; 84,18 hill; 84,19 Sagebrush Steppe), and the
  rules refused them. The engine doesn't count a Wonder district against the frontier rule, but
  `FRONTIER_DISTRICT_CLASSES` lists `WONDER`. Rila isn't offered on urban tiles, so this costs nothing today.
  Rural neighbours never blocked it (accepted tiles by neighbour classes: RURAL 177, RURAL+WILDERNESS 7, RURAL+WONDER 4).

  Shwedagon and Muzibu: every tile the engine took has a lake beside it (7, 8 and 26 tiles), none without, so
  AdjacentLake reads "a lake among the six neighbours". Hale o Keawe agreed 27 of 27 in Exploration 4242. Havana Harbor
  got no engine yes anywhere (no city in distant lands). Hale o Keawe was locked in every AugustusExp66 city.

  Two rule changes wait on the owner: refusing a tile that holds a resource, and dropping `WONDER` from
  `FRONTIER_DISTRICT_CLASSES`. Still to compare: Havana Harbor (a save with a city in distant lands), Hale o Keawe on a
  save where it isn't built yet, and Ubudiah Mosque on a wet urban tile. The harness now holds the live
  `Mods/build-wonders-over-antiquated-buildings` aside and puts it back (or uses it as it is with `live`):

  ```
  zsh run-harness.sh woobh-game-pb27.js AugustusExp66.Civ7Save pb27-exp66-live 2400 live
  ```

- Ubudiah Mosque's wet feature on an urban tile. The rule is now read per tile, so a tile is offered as soon as an
  urban tile holds a Marsh, Oasis, Mangrove, Tundra Bog or Watering Hole. Whether the engine keeps a feature when a
  tile turns urban isn't in the data: `District_RemovedFeatures` is empty in the 1.5.0 XML and in the compiled copy.
  `pb27` prints every urban tile that holds a feature. On 2026-10-17 only Rainforest was seen on urban tiles.
- Canals + Build Wonders, a Canal left unfinished on an urban tile at the age's end. 2026-10-17 `lab3-A` (usual set,
  Exploration 9001 into Modern) didn't reach it: the Canal queued on 29,36 at progress 116 finished on the age's last
  turn (Roma's production overflow carried it to 61% in one turn), so no unfinished Canal crossed. For the next try:
  Oxford University (`NODE_TECH_MO_ACADEMICS`, the cheapest Modern Wonder to unlock, its only rule an urban neighbour)
  is the Wonder to test the tile with.
- The two options and the eleven translations, built 2026-10-15 and watched in a game the same day. The checks a
  run covers are listed at the end of [OPTIONS.md](OPTIONS.md).

## The two designs this replaced

Kept in `mod_ideas_tested/build_wonders_over_antiquated_buildings/archive/convert-wonders/` with their findings.
Route A (give a WONDER an urban placement row): the Wonder is *added* beside the old buildings, never built over
them. Route E (convert Wonders to `FULL_TILE` buildings): works, but Wonders stop being unique and the AI builds
dozens. Both were the engine telling us the same thing from two sides: overbuild is a building-class mechanic, and
a Wonder has to be placed on bare land.
