# Verifying in the game

The hands-free harness (runner, game scripts, the logs of every run so far) lives with the archived routes at
`mod_ideas_tested/build_wonders_over_antiquated_buildings/devtools/harness/`, because most of its scripts drive
routes that were set aside. Its `full` deploy mode copies this folder's modinfo, `ui/`, `lib/` and `text/` into
the game's Mods folder.

The runs that verify this folder's build, all on `AugustusExp66.Civ7Save`, from
`../../mod_ideas_tested/build_wonders_over_antiquated_buildings/devtools/harness`:

```
zsh run-harness.sh woobh-game-pb6.js  AugustusExp66.Civ7Save pb6  900 full   # end to end (through the confirmation the mod had then)
zsh run-harness.sh woobh-game-pb7.js  AugustusExp66.Civ7Save pb7  420 full   # the placement screen, read-only
zsh run-harness.sh woobh-game-pb8.js  AugustusExp66.Civ7Save pb8  600 full   # Grow City screen + the finished tiles
zsh run-harness.sh woobh-game-pb8.js  AugustusExp66.Civ7Save pb8-nodialog 600 full   # the same run with no prompt of the mod's own (1.0.0)
zsh run-harness.sh woobh-game-pb9.js  AugustusExp66.Civ7Save pb9  420 full   # read-only survey: case B tiles, yield APIs, screen positions
zsh run-harness.sh woobh-game-pb11.js AugustusExp66.Civ7Save pb11 420 full   # read-only: the ENGINE's verdict on all 48 Wonders
zsh run-harness.sh woobh-game-pb12.js AugustusExp66.Civ7Save pb12 700 full   # the yield preview on an injected tile
zsh run-harness.sh woobh-game-pb14.js AugustusExp66.Civ7Save pb14 900 full   # sets the board up and waits for a HUMAN click
zsh run-harness.sh woobh-game-pb15.js AugustusExp66.Civ7Save pb15 700 full   # rollback on refusal + the good case still builds
zsh run-harness.sh woobh-game-pb19.js AugustusExp66.Civ7Save pb19 420 full   # raw engine: one-tick burst, 50 ms tile sampling
zsh run-harness.sh woobh-game-pb20.js AugustusExp66.Civ7Save pb20 420 full   # the mod's one-tick clear on three tiles incl. a refusal
SHELL_SRC=woobh-shell-lan-new.js \
  zsh run-harness.sh woobh-game-pb18.js AugustusExp66.Civ7Save pb18 1200 full # a live LAN game, fresh Exploration start
```

`pb14` is the one that needs a person: it opens the placement screen on a chosen tile, logs where on screen the hex
is, and then waits four minutes while you click it. Synthetic clicks are dropped on this machine
without Accessibility permission, so a human click is the reliable route.

Read `<label>-UI.log` afterwards: the `[BWAB]` lines are the mod, the `[WOOB]` lines are the probe. Screenshots
land in `harness/shots/`. `pb6` and `pb8` clear tiles, so run them on a save you do not mind; the runner never
writes to the original save and puts the player's autosaves back.

The one thing none of them does is move the mouse: `pb7` selects the plot through `BuildingPlacementManager` and
`pb6` sends the commit the way `commitPlot` sends it. To check the click itself: open a city's production list,
pick a Wonder, confirm that an urban tile whose buildings are all from an earlier age is highlighted, click it,
and watch the tile clear with no prompt.
