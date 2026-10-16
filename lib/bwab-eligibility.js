// bwab-eligibility.js
//
// "Is this tile one a Wonder may take over?" The single rule, with no engine in it.
//
// It takes plain descriptors and returns a verdict, so the same rule runs offline under the tests
// (tests/eligibility.mjs) and in the mod unchanged. Nothing here calls GameInfo, Districts or
// MapConstructibles; the caller does that and hands the results in.
//
// The rule is the engine's own, restated:
//   a constructible is outdated when its Age is not the current age and it is not AGELESS.
// That is what BuildingPlacementManager.willBecomeQuarter checks, inverted. The Options screen can
// make it stricter (two ages back; see AgeRule), never looser.
//
// fitsPlacement, below evaluateTile, is the other half of the offer: whether a Wonder's own
// placement rules accept a given site. Every rule in the game's data is evaluated per tile, so a
// Wonder is passed over only for a tile that fails one of its rules.
//
// The clear this feeds destroys buildings (a stranded district produced an unusable plot once
// already; DESIGN.md 7b in mod_ideas_tested), so every uncertain case resolves to "not eligible"
// with a reason.

/**
 * One constructible sitting on a tile, reduced to what the rule needs.
 * @typedef {object} ConstructibleInfo
 * @property {string} type The ConstructibleType.
 * @property {string|null} age Constructibles.Age, or null for a type with no age.
 * @property {boolean} ageless Whether it carries the AGELESS tag.
 * @property {boolean} existingDistrictOnly Constructibles.ExistingDistrictOnly (walls).
 * @property {boolean} [damaged] Whether it is damaged and therefore repairable.
 */

/**
 * A tile, reduced to what the rule needs.
 * @typedef {object} TileInfo
 * @property {string} districtType The DistrictType on the plot, or "" when there is none.
 * @property {ConstructibleInfo[]} constructibles Everything on the plot.
 */

/**
 * The verdict for one tile.
 * @typedef {object} Verdict
 * @property {boolean} eligible Whether a Wonder may take this tile over.
 * @property {string} reason A stable reason code; "ok" when eligible.
 * @property {string[]} outdated Types that would be destroyed.
 * @property {string[]} walls Wall types on the tile. Never destroyed; preserved across the clear.
 * @property {string[]} blockers Types that caused a refusal.
 * @property {string[]} notes Things worth reporting that do not change the verdict.
 */

/** The only district a tile may be taken from; never the city center (DESIGN.md 6.4). */
export const ELIGIBLE_DISTRICT = "DISTRICT_URBAN";

/** Reason codes. Stable strings; logs and tests quote them. */
export const REASON = Object.freeze({
  OK: "ok",
  NOT_URBAN: "not-urban",
  EMPTY: "empty",
  CURRENT_AGE: "has-current-age",
  TOO_RECENT: "has-too-recent",
  AGELESS: "has-ageless",
  UNKNOWN_AGE: "has-unknown-age",
});

/**
 * How old a building has to be. The default is the engine's own rule (any earlier age); the Options screen can ask
 * for two ages back, which needs the ages in order to count the gap.
 * @typedef {object} AgeRule
 * @property {number} [agesBack] 1 (the default) or more.
 * @property {string[]} [ageOrder] Every AgeType, oldest first. Needed only when agesBack is above 1.
 */

/**
 * Why one constructible keeps a tile off the list, or null when it is antiquated. Walls are the caller's business.
 * @param {ConstructibleInfo} c
 * @param {string} currentAge The current AgeType.
 * @param {AgeRule} [rule]
 * @returns {string|null} A REASON code, or null.
 */
function blockReason(c, currentAge, rule) {
  if (c.ageless) return REASON.AGELESS;
  if (typeof c.age !== "string" || c.age === "") return REASON.UNKNOWN_AGE;
  if (c.age === currentAge) return REASON.CURRENT_AGE;
  const back = (rule && rule.agesBack) || 1;
  if (back <= 1) return null;
  const order = rule && Array.isArray(rule.ageOrder) ? rule.ageOrder : [];
  const now = order.indexOf(currentAge);
  const then = order.indexOf(c.age);
  if (now < 0 || then < 0) return REASON.UNKNOWN_AGE;
  return now - then >= back ? null : REASON.TOO_RECENT;
}

/**
 * Whether one constructible counts as antiquated. A type with no age is never antiquated: it cannot be compared, so it
 * is left alone.
 * @param {ConstructibleInfo} c
 * @param {string} currentAge The current AgeType.
 * @param {AgeRule} [rule]
 * @returns {boolean} True when the engine would treat it as overbuildable (and, under a stricter rule, it is old
 * enough).
 */
export function isOutdated(c, currentAge, rule) {
  return !!c && blockReason(c, currentAge, rule) === null;
}

/**
 * Judge one tile.
 *
 * Refuses, in this order: a district that is not urban; a tile with nothing (that houses anyone)
 * on it; a tile holding anything not antiquated. Walls (`ExistingDistrictOnly`) neither block nor
 * count: they are listed in `walls` so the caller can keep them, because clearing a tile must not
 * cost the city its defenses.
 *
 * So: one antiquated building, or several, qualifies. One antiquated beside one current-age does not.
 * Two current-age do not. Anything Ageless does not. Under `agesBack: 2`, a building from the previous
 * age does not either.
 *
 * @param {TileInfo} tile
 * @param {string} currentAge The current AgeType.
 * @param {AgeRule} [rule]
 * @returns {Verdict}
 */
export function evaluateTile(tile, currentAge, rule) {
  /** @type {Verdict} */
  const v = { eligible: false, reason: REASON.OK, outdated: [], walls: [], blockers: [], notes: [] };
  if (!tile || tile.districtType !== ELIGIBLE_DISTRICT) return { ...v, reason: REASON.NOT_URBAN };
  const list = Array.isArray(tile.constructibles) ? tile.constructibles : [];
  for (const c of list) {
    if (c && typeof c.type === "string" && c.existingDistrictOnly) { v.walls.push(c.type); continue; }
    const why = c && typeof c.type === "string" ? blockReason(c, currentAge, rule) : REASON.UNKNOWN_AGE;
    if (why) {
      v.blockers.push(String(c && c.type));
      // Keep the first refusal: the order above is the order a reader expects to hear it in.
      if (v.reason === REASON.OK) v.reason = why;
      continue;
    }
    v.outdated.push(c.type);
    // A damaged building can still be repaired; destroying it throws that away. Worth saying,
    // not worth refusing over.
    if (c.damaged) v.notes.push(c.type + " is damaged (repairable; demolishing forfeits that)");
  }
  if (v.reason === REASON.OK && v.outdated.length === 0) v.reason = REASON.EMPTY;
  v.eligible = v.reason === REASON.OK;
  return v;
}

/**
 * One of the six tiles around a site, reduced to what the placement rules need.
 * @typedef {object} NeighbourInfo
 * @property {string} terrain The TerrainType, or "".
 * @property {string} biome The BiomeType, or "".
 * @property {string} district The DistrictType, or "" when there is none.
 * @property {string} districtClass The DistrictClass (URBAN, CITYCENTER, WONDER, RURAL, WILDERNESS), or "".
 * @property {string[]} types Every ConstructibleType standing there.
 * @property {boolean} water
 * @property {boolean} lake
 * @property {string} resource The ResourceType, or "".
 * @property {boolean} capital Whether it is the city center of the owner's capital.
 */

/**
 * A site: the tile a Wonder would stand on, and what is around it.
 * @typedef {object} SiteInfo
 * @property {string} terrain
 * @property {string} biome
 * @property {string} feature The FeatureType, or "".
 * @property {string} featureClass The feature's FeatureClassType, or "".
 * @property {string} resource The ResourceType, or "".
 * @property {boolean|null} river Null when the engine couldn't say.
 * @property {boolean} water
 * @property {boolean} lake
 * @property {boolean|null} adjacentToLand The engine's own answer for a water tile; null when it couldn't say.
 * @property {boolean|null} distantLands Null when the engine couldn't say.
 * @property {NeighbourInfo[]} neighbours
 * @property {(type: string) => number} countInSettlement How many of a type the settlement holds.
 */

/**
 * A Wonder's placement rules, as the game's data holds them: its Constructibles row, its Wonders row, and its rows in
 * the Constructible_* placement tables, keyed by the short table name (ValidTerrains, ValidBiomes, ValidFeatures,
 * RequiredFeatures, RequiredFeatureClasses, InvalidFeatures, ValidResources, InvalidAdjacentBiomes).
 * @typedef {object} PlacementRules
 * @property {*} def The Constructibles row.
 * @property {*} wonder The Wonders row, or null when there is none.
 * @property {Record<string, string[]>} rows The Wonder's values per table; a missing table means no rows.
 */

/** The placement tables, in the order they are checked. */
export const PLACEMENT_TABLES = Object.freeze([
  "ValidTerrains", "ValidBiomes", "ValidFeatures", "RequiredFeatures", "RequiredFeatureClasses", "InvalidFeatures",
  "ValidResources", "InvalidAdjacentBiomes",
]);

/**
 * The districts that count for BuildOnFrontier ("Cannot be placed adjacent to a District", Rila Monastery and Vix):
 * the city's built-up tiles. A rural tile is a district to the engine too (DISTRICT_RURAL), so this list is what the
 * lab check in docs/RECIPE.md settles; it is the one place to change if the engine counts rural tiles as well.
 */
export const FRONTIER_DISTRICT_CLASSES = Object.freeze(["URBAN", "CITYCENTER", "WONDER"]);

/**
 * How RiverPlacement reads, from the constructibles that carry it: RIVER is the bridges, the Bath and the Gristmill,
 * which stand on a river tile; ANCHORED is the Fishing Quay, Harbor, Shipyard, Wharf, Port and the Statue of Liberty,
 * which stand on water beside land; OFF_COAST is the Lighthouse, on water beside land as well.
 */
const RIVER_PLACEMENTS = Object.freeze({
  RIVER: (/** @type {SiteInfo} */ s) => s.river === true,
  ANCHORED: (/** @type {SiteInfo} */ s) => s.water && s.adjacentToLand === true,
  OFF_COAST: (/** @type {SiteInfo} */ s) => s.water && s.adjacentToLand === true,
});

/** @param {PlacementRules} r @param {string} table @returns {string[]} */
function rowsOf(r, table) {
  const v = r.rows && r.rows[table];
  return Array.isArray(v) ? v.map(String) : [];
}

/**
 * The site's own ground against the Wonder's rows: terrain, biome, feature, resource.
 * @param {PlacementRules} r @param {SiteInfo} s @returns {string|null} The failed rule, or null.
 */
function groundRule(r, s) {
  const terrains = rowsOf(r, "ValidTerrains");
  if (terrains.length && !terrains.includes(s.terrain)) return "ValidTerrains";
  const biomes = rowsOf(r, "ValidBiomes");
  if (biomes.length && !biomes.includes(s.biome)) return "ValidBiomes";
  if (r.def.NoFeature && s.feature) return "NoFeature";
  const valid = rowsOf(r, "ValidFeatures");
  if (valid.length && !valid.includes(s.feature)) return "ValidFeatures";
  const required = rowsOf(r, "RequiredFeatures");
  if (required.length && !required.includes(s.feature)) return "RequiredFeatures";
  const classes = rowsOf(r, "RequiredFeatureClasses");
  if (classes.length && !classes.includes(s.featureClass)) return "RequiredFeatureClasses";
  const invalid = rowsOf(r, "InvalidFeatures");
  if (invalid.length && s.feature && invalid.includes(s.feature)) return "InvalidFeatures";
  const resources = rowsOf(r, "ValidResources");
  if (resources.length && !resources.includes(s.resource)) return "ValidResources";
  return null;
}

/**
 * River, lake, water and lands flags.
 * @param {PlacementRules} r @param {SiteInfo} s @returns {string|null}
 */
function flagRule(r, s) {
  const d = r.def, w = r.wonder;
  if (d.AdjacentRiver && s.river !== true) return "AdjacentRiver";
  if (d.NoRiver && s.river) return "NoRiver";
  if (d.RiverPlacement) {
    const test = RIVER_PLACEMENTS[/** @type {keyof RIVER_PLACEMENTS} */ (String(d.RiverPlacement))];
    if (!test || !test(s)) return "RiverPlacement";
  }
  if (w && w.MustBeLake && !s.lake) return "MustBeLake";
  if (w && w.MustNotBeLake && s.lake) return "MustNotBeLake";
  if (d.RequiresHomeland || d.RequiresDistantLands) {
    if (s.distantLands === null || s.distantLands === undefined) return "RequiresHomeland";
    if (d.RequiresDistantLands ? !s.distantLands : s.distantLands) return d.RequiresDistantLands ? "RequiresDistantLands" : "RequiresHomeland";
  }
  return null;
}

/**
 * The rules that look at the six neighbours.
 * @param {PlacementRules} r @param {SiteInfo} s @returns {string|null}
 */
function neighbourRule(r, s) {
  const d = r.def, w = r.wonder;
  const ns = Array.isArray(s.neighbours) ? s.neighbours : [];
  if (d.AdjacentTerrain && !ns.some((n) => n.terrain === String(d.AdjacentTerrain))) return "AdjacentTerrain";
  if (d.AdjacentDistrict && !ns.some((n) => n.district === String(d.AdjacentDistrict))) return "AdjacentDistrict";
  const bad = rowsOf(r, "InvalidAdjacentBiomes");
  if (bad.length && ns.some((n) => bad.includes(n.biome))) return "InvalidAdjacentBiomes";
  if (d.AdjacentLake && !ns.some((n) => n.lake)) return "AdjacentLake";
  if (!w) return null;
  if (w.AdjacentToMountain && !ns.some((n) => n.terrain === "TERRAIN_MOUNTAIN")) return "AdjacentToMountain";
  if (w.AdjacentConstructible && !ns.some((n) => n.types.includes(String(w.AdjacentConstructible)))) return "AdjacentConstructible";
  if (w.AdjacentCapital && !ns.some((n) => n.capital)) return "AdjacentCapital";
  if (w.AdjacentResource && !ns.some((n) => n.resource === String(w.AdjacentResource))) return "AdjacentResource";
  if (w.BuildOnFrontier && ns.some((n) => FRONTIER_DISTRICT_CLASSES.includes(n.districtClass))) return "BuildOnFrontier";
  if (w.AdjacentToLand) {
    const beside = s.water ? s.adjacentToLand === true : ns.some((n) => !n.water);
    if (!beside) return "AdjacentToLand";
  }
  return null;
}

/**
 * Does this Wonder's placement rules accept this site? Every rule in the 1.5.0 data is evaluated here, in the order
 * the game's tables hold them, and the first one the site fails is named. The one rule not read is
 * RequiresAppealPlacement, which no Wonder carries; a Wonder that did would be refused every tile rather than guessed.
 *
 * For a water tile the caller also asks the engine (the coast Wonders' hidden rules; see fitsWater in the UI script).
 * @param {PlacementRules} rules
 * @param {SiteInfo} site
 * @returns {{ok: boolean, failed: string|null}} `failed` names the column or table of the first rule not met.
 */
export function fitsPlacement(rules, site) {
  if (!rules || !rules.def) return { ok: false, failed: "Constructibles" };
  if (!site) return { ok: false, failed: "Site" };
  if (rules.def.RequiresAppealPlacement) return { ok: false, failed: "RequiresAppealPlacement" };
  const failed = groundRule(rules, site) || flagRule(rules, site) || neighbourRule(rules, site)
    || settlementRule(rules, site);
  return { ok: failed === null, failed };
}

/**
 * RequiredConstructibleInSettlement(Count): the settlement must already hold N of a type.
 * @param {PlacementRules} r @param {SiteInfo} s @returns {string|null}
 */
function settlementRule(r, s) {
  const w = r.wonder;
  if (!w || !w.RequiredConstructibleInSettlement) return null;
  const have = typeof s.countInSettlement === "function" ? s.countInSettlement(String(w.RequiredConstructibleInSettlement)) : 0;
  return have >= (w.RequiredConstructibleInSettlementCount || 1) ? null : "RequiredConstructibleInSettlement";
}

/**
 * Judge many tiles and keep the eligible ones.
 * @param {Array<{plot: number, tile: TileInfo}>} tiles The tiles, each with its plot index.
 * @param {string} currentAge The current AgeType.
 * @returns {Array<{plot: number, verdict: Verdict}>} One entry per eligible tile.
 */
export function eligibleTiles(tiles, currentAge) {
  const out = [];
  for (const entry of Array.isArray(tiles) ? tiles : []) {
    if (!entry) continue;
    const verdict = evaluateTile(entry.tile, currentAge);
    if (verdict.eligible) out.push({ plot: entry.plot, verdict });
  }
  return out;
}

/**
 * A one-line summary of a verdict, for a log.
 * @param {number} plot
 * @param {Verdict} v
 * @returns {string}
 */
export function describeVerdict(plot, v) {
  if (!v) return "plot " + plot + ": no verdict";
  if (v.eligible) {
    return "plot " + plot + ": ELIGIBLE, would destroy [" + v.outdated.join(", ") + "]" +
      (v.walls && v.walls.length ? ", keeping walls [" + v.walls.join(", ") + "]" : "") +
      (v.notes.length ? " -- " + v.notes.join("; ") : "");
  }
  return "plot " + plot + ": no (" + v.reason + ")" +
    (v.blockers.length ? " blocked by [" + v.blockers.join(", ") + "]" : "");
}
