// bwab-clear-and-build.js
//
// The mod. When the player places a Wonder, urban tiles whose buildings are all from an earlier
// age are offered as sites. Choosing one clears the tile (its buildings, then its district; walls
// are never destroyed), hands the displaced citizens to the game's own Grow City prompt, and then
// builds the Wonder there through the game's own path. The tile becomes a real DISTRICT_WONDER and
// nothing about Wonders changes: not their class, uniqueness, cinematics, or what the AI does.
//
// Every engine step was watched on 1.5.0 (docs/RECIPE.md):
//   DESTROY_ELEMENT {Kind:"CONSTRUCTIBLE"} per building, then {Kind:"DISTRICT"}  -> bare owned land
//   a stock Wonder then builds on it                                              -> DISTRICT_WONDER
//   city.addRuralPopulation(+1) per citizen  -> a pending point the Grow City prompt asks about
//   walls go down with the district; CREATE_ELEMENT puts them back on the Wonder's district
//
// How it hooks the placement screen: the screen renders Game.CityOperations.canStart(BUILD). The
// wrap appends eligible tiles to `Plots` for a WONDER, answers Success for the per-plot check the
// commit path makes, and intercepts sendRequest(BUILD, {X, Y}) at one of those tiles to clear and
// forward. There is no confirmation of its own: placing a Wonder on one of these tiles is the same
// click as placing it on an empty tile.
//
// Which tiles: lib/bwab-eligibility.js (every occupant previous-age, none AGELESS; walls ignored
// and kept). Which Wonders for a tile: the Wonder's own placement rules, evaluated here; a rule this
// file cannot evaluate excludes the Wonder rather than guessing.
//
// Conventions: one globalThis key with a kill switch and an uninstall that restores the originals,
// every engine call guarded, nothing thrown into an engine callback, warn-level logging, imports
// under the mod id.

import { evaluateTile } from "/tower-build-wonders-over-antiquated-buildings/lib/bwab-eligibility.js";

const G = /** @type {*} */ (globalThis);
const KEY = "__bwab";
const TAG = "[BWAB] ";
/** Engine requests land asynchronously; this is how long a step waits before reading back. */
const SETTLE_MS = 2500;
/** The production list calls canStart per item; the eligible-plot scan is cached this long. */
const CACHE_MS = 1500;

/** @param {string} m The line. */
function log(m) { try { console.warn(TAG + m); } catch (_) { /* logging must never throw */ } }
/**
 * Run an engine read, returning a fallback on any throw.
 * @template T
 * @param {() => T} fn The read. @param {T} fb The fallback. @returns {T}
 */
function safe(fn, fb) { try { return fn(); } catch (_) { return fb; } }
/** @param {*} o @returns {string} */
function J(o) { try { return JSON.stringify(o); } catch (_) { return "?"; } }

/** @type {Set<string>|null} */
let agelessCache = null;
/** @returns {Set<string>} Every type carrying the AGELESS tag. */
function ageless() {
  if (agelessCache) return agelessCache;
  const s = new Set();
  safe(() => { for (const r of GameInfo.TypeTags) if (r.Tag === "AGELESS") s.add(String(r.Type)); }, null);
  agelessCache = s;
  return s;
}
/** @returns {string} The current AgeType. */
function currentAge() { return safe(() => String(GameInfo.Ages.lookup(Game.age).AgeType), ""); }
/** @param {*} cityID @returns {string} */
function cityKey(cityID) { return safe(() => cityID.owner + ":" + cityID.id, String(cityID)); }
/** @param {*} typeOrIndex @returns {*} The Constructibles row, or null. */
function defOf(typeOrIndex) { return safe(() => GameInfo.Constructibles.lookup(typeOrIndex), null); }
/** @param {number} x @param {number} y @returns {string} */
function terrainAt(x, y) {
  return safe(() => String(GameInfo.Terrains.lookup(GameplayMap.getTerrainType(x, y)).TerrainType), "");
}

// --- reading a tile ------------------------------------------------------------------------------

/**
 * @typedef {object} Occupant
 * @property {string} type
 * @property {string|null} age
 * @property {boolean} ageless
 * @property {boolean} existingDistrictOnly
 * @property {boolean} houses Whether it houses a citizen (Population > 0 and complete).
 * @property {{owner:number, id:number}} id For DESTROY_ELEMENT.
 */

/** @param {*} inst A constructible instance. @returns {Occupant|null} */
function describeOccupant(inst) {
  const def = defOf(inst.type);
  if (!def) return null;
  const type = String(def.ConstructibleType);
  return {
    type, age: def.Age || null, ageless: ageless().has(type), existingDistrictOnly: !!def.ExistingDistrictOnly,
    houses: (def.Population || 0) > 0 && inst.complete !== false,
    id: { owner: inst.owner, id: inst.localId != null ? inst.localId : inst.id },
  };
}

/**
 * @typedef {object} Tile
 * @property {number} plot
 * @property {number} x
 * @property {number} y
 * @property {string} districtType
 * @property {{owner:number, id:number}|null} districtId
 * @property {Occupant[]} constructibles
 * @property {string} terrain
 * @property {string} biome
 * @property {boolean|null} river
 * @property {boolean} water
 * @property {boolean} lake
 * @property {string} feature
 */

/** @param {number} plot @returns {Tile|null} Everything the rules need about one plot. */
function readTile(plot) {
  return safe(() => {
    const loc = GameplayMap.getLocationFromIndex(plot);
    const d = Districts.getAtLocation(loc);
    const dd = d ? GameInfo.Districts.lookup(d.type) : null;
    /** @type {Occupant[]} */
    const constructibles = [];
    for (const cid of MapConstructibles.getConstructibles(loc.x, loc.y) || []) {
      const o = describeOccupant(Constructibles.getByComponentID(cid));
      if (o) constructibles.push(o);
    }
    const ids = safe(() => Districts.getIdAtLocation(loc), null);
    return {
      plot, x: loc.x, y: loc.y, districtType: dd ? String(dd.DistrictType) : "",
      districtId: ids && typeof ids.owner === "number" ? { owner: ids.owner, id: ids.id } : null,
      constructibles, terrain: terrainAt(loc.x, loc.y),
      biome: safe(() => String(GameInfo.Biomes.lookup(GameplayMap.getBiomeType(loc.x, loc.y)).BiomeType), ""),
      river: safe(() => !!GameplayMap.isRiver(loc.x, loc.y), null),
      water: safe(() => !!GameplayMap.isWater(loc.x, loc.y), true),
      lake: safe(() => !!GameplayMap.isLake(loc.x, loc.y), true),
      feature: safe(() => {
        const f = GameplayMap.getFeatureType(loc.x, loc.y);
        return f == null || f < 0 ? "" : String(GameInfo.Features.lookup(f)?.FeatureType || "");
      }, ""),
    };
  }, null);
}

/**
 * @param {Tile} tile
 * @returns {Array<{terrain:string, biome:string, district:string, types:string[]}>} The six neighbours.
 */
function neighbours(tile) {
  const out = [];
  for (let dir = 0; dir < 6; dir++) {
    const n = safe(() => GameplayMap.getAdjacentPlotLocation({ x: tile.x, y: tile.y }, dir), null);
    if (!n) continue;
    out.push({
      terrain: terrainAt(n.x, n.y),
      biome: safe(() => String(GameInfo.Biomes.lookup(GameplayMap.getBiomeType(n.x, n.y)).BiomeType), ""),
      district: safe(() => String(GameInfo.Districts.lookup(Districts.getAtLocation(n).type).DistrictType), ""),
      types: safe(() => {
        /** @type {*[]} */ const ids = MapConstructibles.getConstructibles(n.x, n.y) || [];
        return ids.map((c) => String(defOf(Constructibles.getByComponentID(c).type).ConstructibleType));
      }, []),
    });
  }
  return out;
}

// --- does this Wonder fit this tile? ---------------------------------------------------------------

/** @param {string} table @param {string} type @param {string} col @returns {string[]} */
function rowsFor(table, type, col) {
  return safe(() => {
    const o = [];
    for (const r of GameInfo[table]) if (r.ConstructibleType === type) o.push(String(r[col]));
    return o;
  }, []);
}

/**
 * The tile's own terrain, biome and feature against the Wonder's Constructible_Valid* rows.
 * @param {*} def @param {Tile} tile @param {*} cityID @returns {boolean}
 */
function fitsGround(def, tile, cityID) {
  if (tile.water && !fitsWater(def, tile, cityID)) return false;
  const t = String(def.ConstructibleType);
  const terrains = rowsFor("Constructible_ValidTerrains", t, "TerrainType");
  const biomes = rowsFor("Constructible_ValidBiomes", t, "BiomeType");
  if (terrains.length && !terrains.includes(tile.terrain)) return false;
  if (biomes.length && !biomes.includes(tile.biome)) return false;
  if (rowsFor("Constructible_ValidFeatures", t, "FeatureType").length) return false; // needs a feature
  if (def.NoFeature && tile.feature) return false;
  return !usesUnreadRules(def, t);
}

/**
 * Rules no Wonder uses today (required features or feature classes, invalid features, valid resources,
 * river placement); if one ever does, that Wonder is excluded rather than guessed at.
 * @param {*} def @param {string} t @returns {boolean}
 */
function usesUnreadRules(def, t) {
  if (def.RiverPlacement) return true;
  const tables = ["Constructible_RequiredFeatures", "Constructible_RequiredFeatureClasses",
    "Constructible_InvalidFeatures", "Constructible_ValidResources"];
  return tables.some((table) => rowsFor(table, t, "ConstructibleType").length > 0);
}

/**
 * A water tile for one of the five Coast Wonders. Their placement rules live in the engine, not in any table,
 * and the Civilopedia's wording is not the engine's rule either: Nan Madol's tooltip says "Coast adjacent to
 * land, this land must be an Island", yet eight coast tiles beside island land in one empire were accepted by
 * the engine on none (`pb24`), while every city centre there was off-island. So the gate is the engine's own
 * verdict: the Wonder must already be accepted on at least one bare coast tile of this city (its hidden rules
 * are then known to be satisfiable here), and this tile must pass the readable ones (adjacent to land, not a
 * Lake when `MustNotBeLake`). A refusal after that is still rolled back.
 * @param {*} def @param {Tile} tile @param {*} cityID @returns {boolean}
 */
function fitsWater(def, tile, cityID) {
  if (!safe(() => GameplayMap.isAdjacentToLand(tile.x, tile.y), false)) return false;
  const w = safe(() => GameInfo.Wonders.lookup(def.ConstructibleType), null);
  if (w && w.MustNotBeLake && tile.lake) return false;
  const res = engineCanStart(cityID, { ConstructibleType: def.$index });
  const sites = res && res.ExpandUrbanPlots ? Array.from(res.ExpandUrbanPlots) : [];
  return !!(res && res.Success) && sites.some((p) => safe(() => {
    const l = GameplayMap.getLocationFromIndex(p);
    return !!GameplayMap.isWater(l.x, l.y);
  }, false));
}

/**
 * Homeland or distant lands, when the Wonder cares (Grand Bazaar must be at home, Havana Harbor abroad).
 * @param {*} def @param {Tile} tile @returns {boolean}
 */
function fitsLands(def, tile) {
  if (!def.RequiresHomeland && !def.RequiresDistantLands) return true;
  const distant = safe(() => Players.get(GameContext.localPlayerID).isDistantLands({ x: tile.x, y: tile.y }), null);
  if (distant === null) return false;
  return def.RequiresDistantLands ? distant : !distant;
}

/**
 * The Wonder's river and feature flags. Rules this file does not evaluate (lake, appeal) exclude the
 * Wonder rather than guessing.
 * @param {*} def @param {Tile} tile @returns {boolean}
 */
function fitsFlags(def, tile) {
  if (def.AdjacentRiver && tile.river !== true) return false;
  if (def.NoRiver && tile.river) return false;
  return !def.AdjacentLake && !def.RequiresAppealPlacement;
}

/**
 * The Wonders-table rules that look at the six neighbours.
 * @param {*} def @param {*} w The Wonders row. @param {Tile} tile @returns {boolean}
 */
function fitsNeighbours(def, w, tile) {
  const ns = neighbours(tile);
  if (def.AdjacentTerrain && !ns.some((n) => n.terrain === def.AdjacentTerrain)) return false;
  if (def.AdjacentDistrict && !ns.some((n) => n.district === String(def.AdjacentDistrict))) return false;
  if (nextToInvalidBiome(def, ns)) return false;
  if (w.AdjacentToMountain && !ns.some((n) => n.terrain === "TERRAIN_MOUNTAIN")) return false;
  return !w.AdjacentConstructible || ns.some((n) => n.types.includes(String(w.AdjacentConstructible)));
}

/**
 * Constructible_InvalidAdjacentBiomes: a neighbour in one of these biomes rules the tile out.
 * @param {*} def @param {Array<{biome:string}>} ns @returns {boolean}
 */
function nextToInvalidBiome(def, ns) {
  const bad = rowsFor("Constructible_InvalidAdjacentBiomes", String(def.ConstructibleType), "BiomeType");
  return bad.length > 0 && ns.some((n) => bad.includes(n.biome));
}

/**
 * RequiredConstructibleInSettlement(Count): the settlement must already hold N of a type.
 * @param {*} w The Wonders row. @param {*} city @returns {boolean}
 */
function fitsSettlement(w, city) {
  if (!w.RequiredConstructibleInSettlement) return true;
  const need = String(w.RequiredConstructibleInSettlement);
  const have = safe(() => {
    let k = 0;
    for (const id of city.Constructibles.getIds() || []) {
      const d = defOf(Constructibles.getByComponentID(id).type);
      if (d && d.ConstructibleType === need) k++;
    }
    return k;
  }, 0);
  return have >= (w.RequiredConstructibleInSettlementCount || 1);
}

/** @param {*} def @param {Tile} tile @param {*} city @param {*} cityID @returns {boolean} */
function wonderFitsTile(def, tile, city, cityID) {
  if (!fitsGround(def, tile, cityID) || !fitsFlags(def, tile) || !fitsLands(def, tile)) return false;
  const w = safe(() => GameInfo.Wonders.lookup(def.ConstructibleType), null);
  if (!w) return true;
  if (w.MustBeLake || w.AdjacentToLand) return false; // water Wonders
  return fitsNeighbours(def, w, tile) && fitsSettlement(w, city);
}

// --- the injected plot set ---------------------------------------------------------------------

/** @type {Map<string, {at:number, plots:number[]}>} Keyed "cityKey|type". */
const cache = new Map();

/** The engine's refusal when a constructible is fine but has nowhere to go. */
const NO_SITE = "LOC_BUILDING_CONSTRUCT_NO_SUITABLE_LOCATION";

/**
 * Ask the engine directly, with this mod's wrap out of the way.
 * @param {*} cityID @param {*} args @returns {*} The engine's own result, or null.
 */
function engineCanStart(cityID, args) {
  const host = safe(() => Game.CityOperations, null);
  const fn = state.originals && state.originals.canStart;
  if (!host || typeof fn !== "function") return null;
  return safe(() => fn.call(host, cityID, CityOperationTypes.BUILD, args, false), null);
}

/**
 * May this Wonder be offered here at all?
 *
 * This mod decides WHERE a Wonder may go, never WHETHER it may be built. The engine refuses a Wonder
 * for reasons that have nothing to do with the tile -- locked, not yet unlocked, already standing
 * somewhere in the world (`MaxWorldInstances`) -- and those refusals must stand. Watched (`pb11`) in one
 * city: 2 of 48 Wonders buildable, 42 refused with no stated reason, and 4 refused with exactly
 * `LOC_BUILDING_CONSTRUCT_NO_SUITABLE_LOCATION`. Only that last refusal is about placement, so only it
 * is ours to answer.
 *
 * Getting this wrong is not cosmetic: `pb10` cleared a tile for a Wonder another civilization had already
 * built, and the city lost a building for a Wonder that could never be placed.
 * @param {*} cityID @param {*} def @returns {boolean}
 */
function engineAllows(cityID, def) {
  const res = engineCanStart(cityID, { ConstructibleType: def.$index });
  if (!res) return false;
  if (res.Success) return true;
  const reasons = safe(() => Array.from(res.FailureReasons || []), []);
  return reasons.some((r) => String(r) === NO_SITE);
}

/**
 * The plots this Wonder may be offered in this city: eligible tiles the Wonder's rules accept.
 * Cached briefly; the production list asks many times per frame.
 * @param {*} cityID @param {*} def @returns {number[]}
 */
function eligiblePlotsFor(cityID, def) {
  const k = cityKey(cityID) + "|" + def.ConstructibleType;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.plots;
  const plots = [];
  const city = safe(() => Cities.get(cityID), null);
  const mine = city && safe(() => city.owner, -1) === safe(() => GameContext.localPlayerID, -2);
  if (mine && engineAllows(cityID, def)) {
    const age = currentAge();
    for (const plot of safe(() => city.getPurchasedPlots() || [], [])) {
      const tile = readTile(plot);
      if (tile && evaluateTile(tile, age).eligible && wonderFitsTile(def, tile, city, cityID)) plots.push(plot);
    }
  }
  cache.set(k, { at: Date.now(), plots });
  return plots;
}

/**
 * Is this one of the plots we offered for this Wonder?
 *
 * The cached list is preferred, but a miss recomputes rather than answering no: the placement screen
 * always asks for the list before it commits a plot, but nothing guarantees that order, and answering
 * no to a tile we would have offered would refuse a build the player was allowed to make (watched:
 * `pb8` committed without listing first and was refused).
 * @param {*} cityID @param {*} def @param {number} plot @returns {boolean}
 */
function isInjected(cityID, def, plot) {
  const hit = cache.get(cityKey(cityID) + "|" + def.ConstructibleType);
  return hit ? hit.plots.includes(plot) : eligiblePlotsFor(cityID, def).includes(plot);
}

// --- the clear ------------------------------------------------------------------------------------

/**
 * @typedef {object} Clear
 * @property {*} cityID
 * @property {*} def
 * @property {Tile} tile
 * @property {() => void} forward Sends the original BUILD.
 * @property {number} local
 */

/** @type {Array<{plot:number, owner:number, walls:string[]}>} Walls to put back once a Wonder lands. */
const wallRestores = [];

/** @param {Occupant[]} list @returns {string[]} The wall types in it. */
function wallTypes(list) { return list.filter((o) => o.existingDistrictOnly).map((o) => o.type); }

/** How long the burst is given to land before it is judged, in polls of POLL_MS. */
const POLL_MS = 100;
const POLL_MAX = 30;

/**
 * The clear and the build, in ONE tick.
 *
 * Every building's destroy, the district's destroy and the BUILD go to the engine back to back. Watched
 * (`pb19`): the engine takes them in order within one tick and the tile reads DISTRICT_URBAN with its
 * buildings at one sample and DISTRICT_WONDER with the Wonder at the next -- the simulation never holds a
 * bare tile, so the screen never shows one. With fixed waits between the steps it showed empty ground for
 * about seven seconds.
 *
 * The engine's own validation of the BUILD replaces the pre-check this used to make on the bare tile (it
 * cannot be asked about a tile that is not bare yet). What the player is promised is unchanged: nothing is
 * displaced unless the Wonder lands, and a refusal puts the tile back.
 * @param {Clear} c
 */
function clearAndBuild(c) {
  const gone = c.tile.constructibles.filter((o) => !o.existingDistrictOnly);
  const walls = wallTypes(c.tile.constructibles);
  const id = c.tile.districtId;
  if (!id) { log("no district id; nothing done"); return; }
  log(`clearing plot ${c.tile.plot}: [${gone.map((o) => o.type).join(", ")}] go, walls [${walls.join(", ")}] stay, ` +
    `for ${c.def.ConstructibleType}`);
  for (const o of gone) {
    safe(() => Game.PlayerOperations.sendRequest(c.local, "DESTROY_ELEMENT",
      { Kind: "CONSTRUCTIBLE", Owner: o.id.owner, LocalID: o.id.id }), null);
  }
  safe(() => Game.PlayerOperations.sendRequest(c.local, "DESTROY_ELEMENT",
    { Kind: "DISTRICT", Owner: id.owner, LocalID: id.id }), null);
  c.forward();
  setTimeout(() => judge(c, 0), POLL_MS);
}

/**
 * Read what the burst did. Landed: note the walls, add the citizens. Still as it was: the engine refused
 * the clear itself, nothing to undo. Anything else after the grace period: the engine refused the
 * Wonder, so put the tile back.
 * @param {Clear} c @param {number} tries
 */
function judge(c, tries) {
  const now = readTile(c.tile.plot);
  const wonder = String(c.def.ConstructibleType);
  if (now && now.districtType === "DISTRICT_WONDER" && now.constructibles.some((o) => o.type === wonder)) {
    log(`${wonder} is on the tile`);
    noteMissingWalls(c, now);
    addPendingCitizens(c);
    return;
  }
  if (tries < POLL_MAX) { setTimeout(() => judge(c, tries + 1), POLL_MS); return; }
  const before = c.tile.constructibles.map((o) => o.type);
  const untouched = now && now.districtType === "DISTRICT_URBAN" && before.every((t) => now.constructibles.some((o) => o.type === t));
  if (untouched) { log("the engine refused the clear; the tile is untouched"); return; }
  log(`the engine refuses ${wonder} on this tile after all; putting the tile back as it was`);
  rollback(c);
}

/**
 * Walls the district took down are queued to return on the Wonder's district.
 * @param {Clear} c @param {Tile|null} bare The tile as it is now.
 */
function noteMissingWalls(c, bare) {
  const wallsNow = bare ? wallTypes(bare.constructibles) : [];
  log(`cleared: district=${bare ? bare.districtType || "<none>" : "?"} walls standing=[${wallsNow.join(", ")}]`);
  const missing = wallTypes(c.tile.constructibles).filter((w) => !wallsNow.includes(w));
  if (!missing.length) return;
  wallRestores.push({ plot: c.tile.plot, owner: c.local, walls: missing });
  log("  the district took the walls down; they return on the Wonder's district when it lands");
}

/**
 * One pending citizen per housing building destroyed; the game's Grow City prompt places them.
 * @param {Clear} c
 */
function addPendingCitizens(c) {
  const lost = c.tile.constructibles.filter((o) => o.houses && !o.existingDistrictOnly).length;
  const city = safe(() => Cities.get(c.cityID), null);
  for (let i = 0; i < lost; i++) safe(() => city.addRuralPopulation(1), null);
  if (lost) log(`  ${lost} citizen(s) pending: the Grow City prompt asks where they settle`);
}

/**
 * Undo the clear: re-create what was destroyed, buildings first so the district exists again, then the
 * walls that came down with it. No citizens were added, so nothing has to be taken away.
 * @param {Clear} c
 */
function rollback(c) {
  const loc = safe(() => GameplayMap.getLocationFromIndex(c.tile.plot), null);
  const buildings = c.tile.constructibles.filter((o) => !o.existingDistrictOnly);
  const walls = c.tile.constructibles.filter((o) => o.existingDistrictOnly);
  for (const o of buildings) recreate(c, loc, o.type);
  setTimeout(() => {
    for (const o of walls) recreate(c, loc, o.type);
    setTimeout(() => {
      const now = readTile(c.tile.plot);
      const back = now ? now.constructibles.map((o) => o.type) : [];
      const wanted = c.tile.constructibles.map((o) => o.type);
      const missing = wanted.filter((t) => !back.includes(t));
      log(`rollback: district=${now ? now.districtType || "<none>" : "?"} holds=${J(back)}` +
        (missing.length ? ` -- STILL MISSING ${J(missing)}` : " -- the tile is as it was"));
      // The walls are handled here, so drop any pending restore for this plot.
      for (let i = wallRestores.length - 1; i >= 0; i--) {
        if (wallRestores[i].plot === c.tile.plot) wallRestores.splice(i, 1);
      }
    }, SETTLE_MS);
  }, SETTLE_MS);
}

/** @param {Clear} c @param {*} loc @param {string} type */
function recreate(c, loc, type) {
  safe(() => Game.PlayerOperations.sendRequest(c.local, "CREATE_ELEMENT",
    { Kind: "CONSTRUCTIBLE", Type: type, Location: loc, Owner: c.local }), null);
  log(`  re-creating ${type}`);
}

/** After any constructible lands: put walls back on a Wonder district they were taken from. */
function restoreWalls() {
  for (let i = wallRestores.length - 1; i >= 0; i--) {
    const r = wallRestores[i];
    const t = readTile(r.plot);
    if (!t || t.districtType !== "DISTRICT_WONDER") continue;
    const standing = t.constructibles.map((o) => o.type);
    const loc = safe(() => GameplayMap.getLocationFromIndex(r.plot), null);
    for (const w of r.walls) {
      if (standing.includes(w)) continue;
      safe(() => Game.PlayerOperations.sendRequest(r.owner, "CREATE_ELEMENT",
        { Kind: "CONSTRUCTIBLE", Type: w, Location: loc, Owner: r.owner }), null);
      log(`re-created ${w} on the Wonder district at plot ${r.plot}`);
    }
    wallRestores.splice(i, 1);
  }
}

// --- the placement screen's price for a tile we added ---------------------------------------------

/**
 * The engine prices a Wonder per plot in `city.Yields.calculateAllBuildingsPlacements()`, and only for
 * the plots it would itself offer. A tile this mod adds is therefore absent, so the placement screen's
 * yield lookups for it logged an error and returned nothing: no yields on the hex, no breakdown in the
 * panel, and the tile could never be one of the screen's recommendations (watched: `pb6`, `pb7`).
 *
 * This builds the missing entry from the engine's own per-constructible numbers, in the same shape the
 * engine's own entries have (`{plotID, yieldChanges, changeDetails, overbuiltConstructibleID}`):
 *
 *   the Wonder's base yields                 getAllBaseYieldValuesForConstructible
 *   minus what the buildings here now give   the same call for each one that would be destroyed
 *   plus the maintenance they stop costing   city.Constructibles.getMaintenance
 *
 * `overbuiltConstructibleID` stays -1 because the maintenance is already in `yieldChanges`; the engine
 * would otherwise refund one of the buildings twice. Walls are never destroyed, so they never count.
 * @param {number} plot @param {*} def @param {*} city @returns {*} The entry, or null.
 */
function priceTile(plot, def, city) {
  const tile = readTile(plot);
  const yields = safe(() => Array.from(city.Yields.getAllBaseYieldValuesForConstructible(def.$hash)), null);
  if (!tile || !yields) return null;
  for (const o of tile.constructibles) if (!o.existingDistrictOnly) chargeFor(yields, o, city);
  const details = safe(() => Array.from(city.Yields.getAllBaseYieldsForConstructible(def.$hash)), []);
  return { plotID: plot, yieldChanges: yields, changeDetails: details, overbuiltConstructibleID: -1 };
}

/**
 * Take one doomed building out of the running total: its yields stop, its maintenance stops too.
 * @param {number[]} yields The running total, changed in place.
 * @param {Occupant} o The building that would be destroyed. @param {*} city
 */
function chargeFor(yields, o, city) {
  const gone = defOf(o.type);
  const lost = gone && safe(() => Array.from(city.Yields.getAllBaseYieldValuesForConstructible(gone.$hash)), null);
  const kept = safe(() => Array.from(city.Constructibles.getMaintenance(o.type)), null);
  for (let i = 0; i < yields.length; i++) {
    if (lost && typeof lost[i] === "number") yields[i] -= lost[i];
    if (kept && typeof kept[i] === "number") yields[i] += kept[i];
  }
}

/** @type {{manager:*, original:*}} */
const placement = { manager: null, original: null };

/**
 * Answer the placement screen's per-plot lookups for our tiles. The engine's own answer wins whenever
 * it has one, so ordinary plots are untouched and another mod's wrap of the same method still runs.
 * @param {*} BPM The BuildingPlacementManager singleton.
 */
function patchPlacementManager(BPM) {
  if (!BPM || typeof BPM.getPlacementPlotData !== "function" || placement.original) return;
  placement.manager = BPM;
  placement.original = BPM.getPlacementPlotData;
  const original = BPM.getPlacementPlotData.bind(BPM);
  BPM.getPlacementPlotData = (/** @type {number} */ plotIndex) => {
    const mine = original(plotIndex);
    if (mine || !state.enabled) return mine;
    const cityID = safe(() => BPM.cityID, null);
    const def = safe(() => BPM.currentConstructible, null);
    if (!cityID || !def || def.ConstructibleClass !== "WONDER") return mine;
    if (!isInjected(cityID, def, plotIndex)) return mine;
    const city = safe(() => Cities.get(cityID), null);
    return (city && priceTile(plotIndex, def, city)) || mine;
  };
  log("placement screen will price the tiles this mod adds");
}

/** Load the placement manager (it is a normal module) and patch it once. */
async function hookPlacementScreen() {
  try {
    const mod = /** @type {*} */ (await import("/base-standard/ui/building-placement/building-placement-manager.js"));
    patchPlacementManager(mod && (mod.BuildingPlacementManager || mod.default));
  } catch (e) {
    log("could not reach the placement manager (" + e + "); tiles will show no yield preview");
  }
}

// --- the hooks ----------------------------------------------------------------------------------

/** @type {{enabled:boolean, originals:{canStart:*, sendRequest:*}|null}} */
const state = { enabled: true, originals: null };

/** @param {*} args @returns {number} The plot index of an {X, Y} request, or -1. */
function plotOf(args) {
  if (!args || args.X == null || args.Y == null) return -1;
  return safe(() => GameplayMap.getIndexFromLocation({ x: args.X, y: args.Y }), -1);
}

/** @param {*} type @param {*} args @returns {*} The Wonder row a BUILD request names, else null. */
function wonderOf(type, args) {
  if (!state.enabled || type !== CityOperationTypes.BUILD || !args) return null;
  const def = defOf(args.ConstructibleType);
  return def && def.ConstructibleClass === "WONDER" ? def : null;
}

/** @param {*} res The engine's answer. @param {number[]} extra @returns {*} The answer plus our plots. */
function withPlots(res, extra) {
  const plots = Array.from((res && res.Plots) || []);
  for (const p of extra) if (!plots.includes(p)) plots.push(p);
  return { ...res, Success: true, Plots: plots };
}

/**
 * The canStart wrap: offer eligible tiles for a Wonder; accept the per-plot check on one.
 * @param {Function} oCan The engine's canStart, bound.
 */
function wrapCanStart(oCan) {
  return function (/** @type {*} */ cityID, /** @type {*} */ type, /** @type {*} */ args, /** @type {*[]} */ ...rest) {
    const res = oCan(cityID, type, args, ...rest);
    const def = wonderOf(type, args);
    if (!def) return res;
    const plot = plotOf(args);
    if (plot >= 0) return isInjected(cityID, def, plot) ? { ...res, Success: true, FailureReasons: [] } : res;
    const extra = eligiblePlotsFor(cityID, def);
    return extra.length ? withPlots(res, extra) : res;
  };
}

/**
 * The sendRequest wrap: a Wonder BUILD at an injected tile is cleared, then forwarded.
 * @param {Function} oSend The engine's sendRequest, bound.
 */
function wrapSendRequest(oSend) {
  return function (/** @type {*} */ cityID, /** @type {*} */ type, /** @type {*} */ args, /** @type {*[]} */ ...rest) {
    const def = wonderOf(type, args);
    const plot = def ? plotOf(args) : -1;
    const tile = plot >= 0 && isInjected(cityID, def, plot) ? readTile(plot) : null;
    if (!tile || tile.districtType !== "DISTRICT_URBAN") return oSend(cityID, type, args, ...rest);
    const local = safe(() => GameContext.localPlayerID, -1);
    const forward = () => oSend(cityID, type, args, ...rest);
    clearAndBuild({ cityID, def, tile, forward, local });
    return true;
  };
}

/** Install the two wraps and the wall-restore listeners. @returns {boolean} */
function install() {
  const host = safe(() => Game.CityOperations, null);
  if (!host || typeof host.canStart !== "function" || typeof host.sendRequest !== "function") {
    log("Game.CityOperations not wrappable; mod inactive");
    return false;
  }
  state.originals = { canStart: host.canStart, sendRequest: host.sendRequest };
  host.canStart = wrapCanStart(host.canStart.bind(host));
  host.sendRequest = wrapSendRequest(host.sendRequest.bind(host));
  safe(() => engine.on("ConstructibleAddedToMap", () => setTimeout(restoreWalls, SETTLE_MS)), null);
  safe(() => engine.on("PlayerTurnActivated", () => setTimeout(restoreWalls, SETTLE_MS)), null);
  hookPlacementScreen();
  log("active: antiquated urban tiles are offered to Wonders");
  return true;
}

/** Restore the engine's own methods. The wall-restore listeners stay; they are inert without work. */
function uninstall() {
  const host = safe(() => Game.CityOperations, null);
  if (host && state.originals) {
    host.canStart = state.originals.canStart;
    host.sendRequest = state.originals.sendRequest;
  }
  if (placement.manager && placement.original) {
    placement.manager.getPlacementPlotData = placement.original;
    placement.manager = null;
    placement.original = null;
  }
  state.enabled = false;
  log("uninstalled");
}

if (!G[KEY]) {
  G[KEY] = {
    version: "1.0.0",
    /** Kill switch: false makes every wrap pass straight through. */
    set enabled(v) { state.enabled = !!v; },
    get enabled() { return state.enabled; },
    uninstall, eligiblePlotsFor, readTile, wallRestores, priceTile,
  };
  install();
}
