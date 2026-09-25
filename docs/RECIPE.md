# The shipped design, and the runs that proved it

**Build Wonders Over Antiquated Buildings works, end to end, with no data change at all.** Watched on 1.5.0,
2026-09-24: `pb5` under the mod's old name, then `pb6`, `pb7` and `pb8` against this folder after the rename.
`pb6` drove it through the mod's own hooks exactly as a player's click drives them, and pressed the mod's own
confirmation with a real button press; `pb7` read and photographed the Wonder placement screen; `pb8` committed
without listing first (the case that found the cache fix below), placed the displaced citizens through the game's
own Grow City screen, and photographed the finished tiles.

```
T1  plot 2780  ["BUILDING_AMPHITHEATER","BUILDING_ACADEMY"]                 both Antiquity, DISTRICT_URBAN
      listed by the placement screen  accepted at the plot  cleared  built
      -> DISTRICT_WONDER ["WONDER_BUSEOKSA"]          pop 26 -> 26   pendingPopulation 2 (the player's prompt)

T2  plot 3912  ["BUILDING_BLACKSMITH","BUILDING_ACADEMY","BUILDING_ANCIENT_WALLS"]   hill
      cleared: walls went with the district; re-created on the Wonder's district when it landed
      -> DISTRICT_WONDER ["WONDER_EL_ESCORIAL","BUILDING_ANCIENT_WALLS"]   pop 16 -> 16   walls PRESERVED
```

Real, stock, class-`WONDER` Wonders. Their uniqueness, their cinematics, their terrain rules, the adjacency bonus
their neighbours read from `DISTRICT_WONDER`, and everything the AI does are untouched, because nothing about
Wonders is touched. The mod clears the tile and lets the game build on it.

---

## What the player does

Pick a Wonder in production. Urban tiles whose buildings are all antiquated now show as valid sites alongside the
usual ones. Choose one; a confirmation names what will be cleared, says the walls stay, and says you will be asked
where the displaced citizens settle. Confirm. The tile is cleared, the Wonder is queued there, and the game's own
Grow City prompt asks you to place each displaced citizen (rural tile or specialist seat, wherever you like) before
the turn can end.

## What qualifies: the rule (`lib/bwab-eligibility.js`, 23 tests)

| Tile holds | Offered |
|---|---|
| one antiquated building, free slot or not | yes |
| two (or more) antiquated buildings | yes |
| one antiquated beside one current-age | **no** |
| two current-age | **no** |
| anything Ageless (Palace, City Hall, Harbor, unique-quarter buildings, Wonders) | **no** |
| walls, alongside any of the above | walls neither block nor count; they are kept |

Antiquated = previous age and not `AGELESS`. The engine itself enforces none of this (watched: it offers every
terrain-valid urban tile whatever stands on it), so this rule is the only thing that decides what is ever cleared.

The Wonder's own placement rules are checked in script before a tile is offered for it: terrain, biome, feature,
river, adjacent terrain, adjacent district, adjacent mountain, adjacent constructible, invalid adjacent biomes,
homeland or distant lands, and the required constructible in the settlement -- every placement rule the database
holds for a Wonder. The two it does not evaluate (lake adjacency, appeal placement), and any rule table no Wonder
uses today, exclude that Wonder rather than guessing.

**The coast Wonders' rules are the engine's alone, and the engine is asked.** Nan Madol was refused on a cleared
Coast tile that satisfied every table rule (`pb14`); a survey of every coast tile in all eighteen cities (`pb22`)
found the engine accepting it nowhere; and its Civilopedia wording ("Coast adjacent to land, this land must be an
Island") is not the engine's rule either: eight coast tiles beside island land were accepted on none (`pb24`),
while every city centre in that empire is off-island. So for a water tile the gate is empirical: the Wonder must
already be accepted by the engine on at least one bare coast tile of the same city -- proof its hidden rules can
be met there -- and the tile must pass the readable ones (adjacent to land; not a Lake where `MustNotBeLake`;
Distant Lands and no Tundra neighbour where the data says so). Watched (`pb25`): the Lighthouse tile is not
offered to Nan Madol, which the engine accepts nowhere, while the two land tiles still build. A coast Wonder
actually landing on a coastal urban tile needs a game where the engine accepts it somewhere, and has not been.

## How it works: every step watched

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
| the confirmation | `DialogBoxManager.createDialog_ConfirmCancel`, raised on a deferred tick; the OK press drives the clear | `pb6` |
| the displaced citizens reach the player's own screen | `INTERFACEMODE_ACQUIRE_TILE` with `panel-place-population` in the DOM, the game's Grow City placement screen, holding the points the clear created; placing them took `pendingPopulation` to 0 | `pb8` |
| a player's own click drives all of it | a human clicked the hex and the confirmation; the clear followed from that click | `pb14` |
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

Population is conserved: the citizens the cleared buildings housed come back as points the player places. The
confirmation read "Amphitheater and Academy will be cleared to build Buseoksa here. You will be asked where the 2
displaced citizens settle." - composed, no raw tags, correct plural - and the OK press did the rest. The game
played its own Wonder completion cinematic ("New Wonder - BUSEOKSA - Leeds, 1050 CE"), which is the engine
treating it as the ordinary Wonder it is.

## The order the screen asks in, and why it no longer matters

The placement screen lists a Wonder's plots (`canStart` with no `X`/`Y`) before it commits one (`canStart` with
them), so the mod's per-plot answer was read from the list it had just computed. `pb8` committed without listing
first and was refused: nothing guarantees that order, and a refusal there would deny a build the player was
allowed to make. `isInjected` now recomputes on a cache miss instead of answering no, and `pb8` then ran through.

## What the mod may and may not decide

This mod decides **where** a Wonder may go. It never decides **whether** one may be built. The engine refuses a
Wonder for reasons that have nothing to do with any tile -- locked, not yet unlocked, already standing somewhere in
the world -- and those refusals are left alone. Measured in one city (`pb11`): 2 of 48 Wonders buildable, 42
refused with no stated reason, and 4 refused with exactly `LOC_BUILDING_CONSTRUCT_NO_SUITABLE_LOCATION`. Only that
last refusal means "nowhere to put it", and only it is this mod's business.

That distinction is not academic: before it existed, a tile was cleared for a Wonder another civilization had
already built, and the city lost a building for a Wonder that could never be placed (`pb10`).

## The clear is reversible, because the engine cannot be asked in advance

The engine will not say whether a Wonder fits a tile until the tile is empty, and it enforces rules that are not in
the database tables a mod can read. Watched (`pb14`): every readable rule passed -- the tile really was
`TERRAIN_COAST`, which is the only terrain `WONDER_NAN_MADOL` accepts -- and the engine still refused the cleared
plot. A player's Lighthouse went with it.

So the clear is judged after the fact: every destroy and the BUILD go to the engine in one tick, the mod then
reads the tile, and only if the Wonder is standing are the displaced citizens added. If the engine refused the
Wonder, the mod re-creates the buildings and walls it destroyed. Watched (`pb15`, `pb20`): the tile came back as
`DISTRICT_URBAN` holding its Lighthouse, with population, urban and rural counts unchanged and nothing pending.

## Nothing bare is ever drawn

The three requests -- each building's destroy, the district's destroy, the BUILD -- are sent back to back in one
tick. Watched raw (`pb19`) and through the mod's own path (`pb20`), sampling the tile every 50 ms: it reads
`DISTRICT_URBAN` with its buildings at one sample and `DISTRICT_WONDER` with the Wonder at the next (146 ms after
the request), and no sample ever reads a bare tile. The simulation never holds an empty hex, so the screen never
shows one; the buildings are replaced by the Wonder's construction site directly. With the earlier fixed waits
between the steps, empty ground was on screen for about seven seconds.

The one time bare ground would be drawn is a refusal: the mod learns the engine said no only by the Wonder's
absence, so it waits three seconds before restoring the tile (`pb20`, 75 ms to 3.6 s). With water tiles no longer
offered, no refusal has been observed; the rollback stays as the backstop for a rule nobody has met yet.

## The yield preview

A plot the mod injects has no `PlacementPlotData` of its own, because the engine computes that only for the plots
it would have offered, so the placement screen used to show no yields for our tile and log an error (`pb6`, `pb7`).
The mod now answers `getPlacementPlotData` for its own plots, building the entry from the engine's own
per-constructible numbers: the Wonder's base yields, minus the yields of the buildings that would go, plus the
maintenance they would stop costing. Watched (`pb12`): Gold -4, Happiness +1.66 on a Lighthouse tile, with the hex
and the panel both reading them.

It is a first-order figure: yields a Wonder grants conditionally, and adjacency the old buildings were receiving,
are not modelled. No Wonder in the game has adjacency rows of its own (0 of 48), which is why the Wonder side of it
is exact.

Two smaller things worth knowing, both probe-side rather than mod-side: the Wonder completion cinematic is modal
and blocks camera work until `.cinematic-moment__close-button` is pressed, and `UI.Player.selectCity()` switches
interface mode asynchronously, so a `switchTo` issued in the same tick is clobbered (that is what made `pb6`
report the placement screen as empty; `pb7`, with a wait between them, read it correctly).

## What is still not watched

Case B, the player's own click, a refusal costing nothing and a live LAN game are all watched now (`pb14`, `pb15`,
`pb18`).
What is left:

- **Two people placing at once.** In `pb18` the probe and the player each committed Grand Bazaar within six
  seconds; the engine took the first and refused the second, and the rollback restored the second tile. The mod
  behaved, but a probe's `__bwabAutoConfirm` is global and skipped the player's dialog: never leave it set in a game
  a person is playing.
- **A coast Wonder actually landing on a coastal urban tile.** The gate needs the engine to accept that Wonder
  on some bare coast tile of the city first; no save to hand has one.
- **Whether any tile is ever refused now.** If one is, the cost is the three-second empty hex and a wasted
  confirmation, not a lost building.

## The two designs this replaced

Kept in `mod_ideas_tested/build_wonders_over_antiquated_buildings/archive/convert-wonders/` with their findings.
Route A (give a WONDER an urban placement row): watched, the Wonder is *added* beside the old buildings, never
built over them. Route E (convert Wonders to `FULL_TILE` buildings): watched working, but Wonders stop being unique
and the AI builds dozens. Both were the engine telling us the same thing from two sides: overbuild is a
building-class mechanic, and a Wonder has to be placed on bare land.
