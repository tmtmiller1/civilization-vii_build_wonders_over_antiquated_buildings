# The two options

Status: built, covered by the offline tests (`npm run verify`) and watched in a game on 2026-10-15. The checks a
run covers are at the end.

Both sit in Options > Add-ons under a **Build Wonders Over Antiquated Buildings** header, in the main menu and in a
game. They're the player's own preference, so they live in the shared settings store and never in the save.

| Option | Kind | Stored as | Default | What changes |
| --- | --- | --- | --- | --- |
| Offer antiquated tiles for Wonders | checkbox | `enabled` | on | whether the mod offers any tile at all |
| Antiquated means | dropdown | `rule` | `"earlier"` (From any earlier age) | which buildings count as antiquated |

## Offer antiquated tiles for Wonders

On is the mod as it shipped in 1.0.x. Off, the Wonder placement screen shows only the game's own sites with the
game's own yield figures, and a click on any site goes straight to the game. The change applies the next time the
placement screen lists sites: the mod drops its short-lived list of plots when the setting changes.

A clear that's already under way when you switch it off finishes as it would have. The citizens still arrive once the
Wonder stands, the walls still come back on the Wonder's district, and a refusal still puts the tile back. Only the
offering stops.

The troubleshooting switch in the console (`globalThis.__bwab.enabled = false`) stays separate. The mod offers tiles
only while both are on.

## Antiquated means

- **From any earlier age** (`"earlier"`, the default). The rule the mod shipped with: a tile is offered when every
  building on it is from an earlier age than the current one.
- **From two ages back** (`"two-ages"`). A building counts only when its age is at least two ages before the current
  one. In the Modern age a tile of Antiquity buildings is offered and a tile holding an Exploration building isn't. In
  the Exploration age only Antiquity is behind you, one age back, so the placement screen shows only the game's own
  sites. The tooltip says so.

Everything else in the rule stays as it is under both choices. An Ageless building or a current-age building keeps a
tile off the list, walls neither qualify a tile nor block it and are kept, and the city center is never offered.

The ages are put in order by `Ages.ChronologyIndex`, the column the game's own unlocks screen sorts by, and the gap is
counted in places in that order rather than by the raw numbers (0, 1, 2 in a compiled gameplay database read here;
10, 20, 30 in the setup data). A building whose age isn't in that list blocks the tile under "two ages back", the
same way a building with no age blocks it today. The rule itself is `lib/bwab-eligibility.js`
(`evaluateTile(tile, currentAge, { agesBack, ageOrder })`), engine-free and tested.

The dropdown is greyed out while the checkbox is off.

A third, looser choice was considered and left out: letting a tile with one antiquated and one current-age building
qualify. It would destroy a building from the age you're in, which the mod's name and every page about it promise it
won't do.

## Where the values live

The shared `modSettings` row in the game's localStorage, the one every Tower mod uses. `ui/settings-keeper.js` (BUILD
112, copied unchanged) keeps that row readable across a restart. The mod's section is keyed by its mod id:

```json
{ "tower-build-wonders-over-antiquated-buildings": { "enabled": true, "rule": "earlier" } }
```

A missing or unknown value reads as the default. A write goes ahead only when the row reads back as a settings root
(`{ "<modId>": {...}, ... }`), the same guard the other Tower mods use, so a bad read can't copy another mod's data
over the store.

Nothing goes into `GameConfiguration`. The setting decides what one player's placement screen offers and doesn't
change any game data, so the save doesn't need a copy and `AffectsSavedGames` stays 0. In a multiplayer game each
player's own setting decides what that player is offered.

## Read once, keep it in memory

The `canStart` wrap runs once per production-list item, many times a frame while the list is open, and one read of the
shared row costs about 6.5 ms (the row holds every mod's data, half a megabyte or more). So `ui/bwab-settings.js` reads
the row once, on first use, and keeps the values in memory. After that:

- A change made on the Options screen writes the row, updates the copy in memory and sends `bwab-settings-changed` on
  `window`. `ui/bwab-clear-and-build.js` drops its cached plot lists on that event.
- The first time the Options screen opens in a session it reads the row once, so the rows show what the main menu
  last wrote.
- The start of each of your turns reads the row once. That covers a write from a screen that runs in another script
  context, if the in-game Options screen turns out to be one; the lab check below settles which.

In play that comes to one read when the game loads, one the first time the Options screen opens, and one per turn.

## Files

| File | Role |
| --- | --- |
| `ui/bwab-settings.js` | the values, their defaults, the read-once cache and the guarded write; no imports |
| `ui/bwab-options.js` | the two rows in Options > Add-ons; loaded in the main menu and in a game |
| `ui/bwab-clear-and-build.js` | reads `getSettings()` in its hooks and passes the rule to `evaluateTile` |
| `lib/bwab-eligibility.js` | the rule, with the `agesBack` / `ageOrder` choice |
| `tests/settings.mjs` | defaults, one read for many lookups, write-through, refresh, the write guard |
| `tests/eligibility.mjs` | the two-ages cases beside the shipped ones |

## What a lab run has to show

Watched in a game on 2026-10-15. The list stays as what a run has to cover after a change to the options.

1. The header and both rows show in Options > Add-ons in the main menu and in a game, in English and in one other
   language, with no raw `LOC_` tags.
2. Untick the checkbox in a game, open a Wonder's placement screen: only the game's own sites are highlighted. Tick it
   again: the antiquated tiles come back without a restart. If they don't, the in-game Options screen runs in another
   script context and the change waits for the next turn; write that down in `docs/RECIPE.md`.
3. In a Modern-age game with a tile of Antiquity buildings and a tile holding an Exploration building, pick "From two
   ages back": the first is offered and the second isn't. In an Exploration-age game the same choice leaves only the
   game's own sites.
4. Set both away from their defaults, quit to the desktop, start the game again: both still read as set, in the main
   menu and in a loaded game.
5. Cancel on the Options screen puts back what was there on opening.
6. The production list stays as quick as before with the list open (the read happens once, not per item).

The placement checks for Rila Monastery, the lake Wonders and Ubudiah Mosque have nothing to do with the options;
they're the `pb27` run at the end of [RECIPE.md](RECIPE.md), under "What is still open".
