[h1]Build Wonders Over Antiquated Buildings[/h1]
[b]Version 0.3.0, the first release. For Civilization VII 1.5.0.[/b]
A city that filled its centre in Antiquity has nowhere left to put a Wonder. This mod lets you build one over the buildings that age left behind. Pick a Wonder in production and urban tiles whose buildings are all from an earlier age are offered as sites alongside the usual ones. Choose one: the old buildings are cleared, the walls stay, the citizens they housed are yours to place through the game's own Grow City prompt, and the Wonder rises on a proper Wonder district. No database changes, so a Wonder built this way is the same Wonder the game ships: its class, its one-in-the-world uniqueness, its cinematics, its terrain rules, the bonus its neighbours read from a Wonder district, and everything the AI does are untouched.
[h2]Mechanics[/h2]
[list]
[*][b]Compatible with 1.5.0.[/b]
[*][b]Antiquated tiles become Wonder sites.[/b] An urban tile qualifies when every building on it is from a previous age, whether that is one building or two. The Wonder placement screen offers it like any other valid plot.
[*][b]Your Wonder, not a substitute.[/b] The tile is cleared and the stock Wonder is queued there through the game's own build path. Nothing about Wonders is redefined, so uniqueness, adjacency, cinematics and AI behaviour are exactly as they are without the mod.
[*][b]No empty hex.[/b] The clear and the build order go to the game in the same instant, so the tile goes straight from its old buildings to the Wonder's construction site.
[*][b]The walls stay.[/b] Clearing a tile takes its district down, and walls go with it; the mod puts them back on the Wonder's district when it lands. The mod never destroys a wall.
[*][b]Your citizens are not lost.[/b] One citizen per building that housed one comes back as a pending population point once the Wonder is standing, and the game's own Grow City prompt asks where each one settles: a rural tile or a specialist seat, wherever you like.
[*][b]A confirmation before anything is cleared.[/b] It names the buildings by name, says how many displaced citizens you will be asked to place, and says the walls stay when the tile has any. Cancel and nothing happens.
[*][b]It decides where, never whether.[/b] A Wonder that is locked, not yet unlocked, or already standing somewhere in the world stays refused, exactly as the base game refuses it. The mod only ever answers the one refusal that means there is nowhere to put it.
[*][b]The Wonder's own rules still decide.[/b] Terrain, biome, river, no-feature, adjacent terrain, adjacent district, adjacent mountain, adjacent constructible, invalid adjacent biomes, homeland or distant lands, and a required constructible in the settlement are all checked before a tile is offered for a given Wonder. A rule the mod does not evaluate excludes that Wonder rather than guessing: one that must stand on a feature, beside a lake, or on an appeal-chosen site is never offered an antiquated tile. The five Coast Wonders are offered a coastal urban tile only when the game already accepts that Wonder on a bare coast tile of the same city. So the mod will sometimes offer less than it could and never more.
[*][b]A refusal costs you nothing.[/b] The game will not say whether a Wonder fits a tile until the tile is empty, and it enforces rules no mod can read in advance. If it turns the cleared site down, the mod puts the buildings and walls back within a few seconds, no citizens are displaced (they are only added once the Wonder is standing), and nothing is lost but the confirmation you pressed.
[*][b]A yield preview on the offered tile.[/b] The placement screen shows what the swap is worth: the Wonder's yields, less the yields of the buildings that would go, plus the maintenance they would stop costing.
[*][b]No database change at all.[/b] One script, no data files, nothing added to the game's tables.
[*][b]Readable, un-minified source.[/b]
[/list]
[h2]What the player does[/h2]
Start a Wonder in a city that has run out of open ground. On the placement screen, tiles holding only antiquated buildings are selectable. Click one and confirm. The tile is cleared, the Wonder is queued there, and before the turn can end the Grow City prompt asks you to place each displaced citizen. The Wonder then builds and completes with the game's own Wonder cinematic.
[h2]Which tiles qualify[/h2]
[list]
[*][b]Yes:[/b] one antiquated building, or two or more, on an urban tile.
[*][b]No:[/b] a tile holding a current-age building, even beside an antiquated one.
[*][b]Never:[/b] anything Ageless — the Palace, the City Hall, a Harbor, unique-quarter buildings, and Wonders themselves.
[*][b]Walls:[/b] neither qualify a tile nor disqualify it, and are kept either way.
[/list]
[h2]What it costs[/h2]
The tile. Those buildings' yields and maintenance are gone, the city has fewer building slots, and the tile holds the Wonder from then on. The head count is unchanged once you have placed the displaced citizens.
[h2]Compatibility[/h2]
[list]
[*][b]Save-safe both ways.[/b] Nothing is added to the database, so a save loads with the mod on or off, and it can join a game already in progress. A Wonder already built this way is ordinary constructible state.
[*][b]No base-game files are replaced,[/b] and mods that adjust Wonder data are unaffected, because this mod does not touch Wonder data.
[*][b]Your own city only.[/b] The clear and the build are the local player's actions on the local player's own settlement.
[*][b]Multiplayer.[/b] Watched in a live LAN game: the clear, the build and the displaced citizens all went through the network session, and a competing placement was refused by the game and rolled back intact.
[/list]
[h2]Languages[/h2]
English only for now. The mod's text is six strings, so a translation is a very small job: ask for a language and I will add it.
[h2]Caveats and known issues[/h2]
[list]
[*][b]A refusal leaves the hex empty for a few seconds.[/b] The mod waits about three seconds for the Wonder to appear before it puts the tile back.
[*][b]The yield preview is a first-order figure.[/b] It counts the Wonder's own yields, the yields of the buildings that would go, and their maintenance. Yields a Wonder grants only under some condition, and adjacency the old buildings were receiving, are not in it.
[*][b]The AI does not do this.[/b] Opponents build Wonders exactly as they always have; the mod adds sites to your placement screen only.
[*][b]Clearing happens when you confirm,[/b] not when the Wonder finishes. The buildings come back only if the game refuses the site.
[/list]
[h2]Still coming[/h2]
[list]
[*][b]An options panel.[/b] A switch for the mod as a whole, and a choice of how strict the antiquated rule is.
[*][b]The placement rules not yet evaluated[/b] (a required feature, lake adjacency, appeal placement), so those Wonders are offered too.
[/list]
[h2]Source and documentation[/h2]
[list]
[*]Open source on GitHub: [url=https://github.com/tmtmiller1/civilization-vii_build_wonders_over_antiquated_buildings]source and full documentation[/url], and the [url=https://github.com/tmtmiller1/civilization-vii_build_wonders_over_antiquated_buildings/releases]release notes[/url].
[/list]
[h2]Credits[/h2]
[list]
[*][b]Tower[/b], for design and Civilization VII implementation.
[/list]
[h2]Special Thanks[/h2]
[list]
[*][b]Potato McWhisky[/b], for teaching me to love again, Civilization-wise (Civ VI), after growing up as a Civilization II, IV, and V player. Making this mod is an act of faith that the community will eventually help make Civilization VII as good as the previous entries.
[/list]
