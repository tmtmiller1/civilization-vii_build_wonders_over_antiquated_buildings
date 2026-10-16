// Offline tests for lib/bwab-eligibility.js.
//
// The module is engine-free, so these run under plain node with no loader and no stubs: `npm test`
// from the mod root.
//
// They cover the rule itself: it refuses every case it should, in the order it should, and names
// the right blockers. Nothing here touches the game; how the engine behaves on a cleared tile is
// docs/RECIPE.md's business.

import assert from "node:assert/strict";
import {
  evaluateTile, eligibleTiles, isOutdated, describeVerdict, fitsPlacement, REASON, PLACEMENT_TABLES,
  FRONTIER_DISTRICT_CLASSES,
} from "../lib/bwab-eligibility.js";

const AGE = "AGE_EXPLORATION";
const PREV = "AGE_ANTIQUITY";

/** @returns {object} A constructible descriptor with sensible defaults. */
const c = (over = {}) => ({
  type: "BUILDING_LIBRARY",
  age: PREV,
  ageless: false,
  existingDistrictOnly: false,
  ...over,
});

/** @returns {object} An urban tile holding the given constructibles. */
const urban = (...list) => ({ districtType: "DISTRICT_URBAN", constructibles: list });

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// isOutdated

test("a previous-age, non-ageless building is outdated", () => {
  assert.equal(isOutdated(c(), AGE), true);
});

test("a current-age building is not outdated", () => {
  assert.equal(isOutdated(c({ age: AGE }), AGE), false);
});

test("an AGELESS building is never outdated, whatever its age", () => {
  assert.equal(isOutdated(c({ ageless: true }), AGE), false);
  assert.equal(isOutdated(c({ age: PREV, ageless: true }), AGE), false);
});

test("a building with no age is not outdated (cannot be compared)", () => {
  assert.equal(isOutdated(c({ age: null }), AGE), false);
  assert.equal(isOutdated(c({ age: "" }), AGE), false);
});

test("isOutdated tolerates a missing constructible", () => {
  assert.equal(isOutdated(null, AGE), false);
  assert.equal(isOutdated(undefined, AGE), false);
});

// the player-facing cases from DESIGN.md 1

test("case A: two outdated buildings is eligible, both listed for destruction", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_LIBRARY" }), c({ type: "BUILDING_BATH" })), AGE);
  assert.equal(v.eligible, true);
  assert.equal(v.reason, REASON.OK);
  assert.deepEqual(v.outdated, ["BUILDING_LIBRARY", "BUILDING_BATH"]);
  assert.deepEqual(v.blockers, []);
});

test("case B: one outdated building and a free slot is eligible", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_MARKET" })), AGE);
  assert.equal(v.eligible, true);
  assert.deepEqual(v.outdated, ["BUILDING_MARKET"]);
});

test("case C: a current-age building blocks the tile and is named", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_LIBRARY" }), c({ type: "BUILDING_BANK", age: AGE })), AGE);
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.CURRENT_AGE);
  assert.deepEqual(v.blockers, ["BUILDING_BANK"]);
});

test("case D: an AGELESS building blocks the tile", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_PARTHENON", ageless: true })), AGE);
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.AGELESS);
  assert.deepEqual(v.blockers, ["BUILDING_PARTHENON"]);
});

test("case E: the city center is refused as not-urban", () => {
  const v = evaluateTile({ districtType: "DISTRICT_CITY_CENTER", constructibles: [c()] }, AGE);
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.NOT_URBAN);
});

// the district gate

test("rural, wilderness, wonder and district-less plots are all refused", () => {
  for (const d of ["DISTRICT_RURAL", "DISTRICT_WILDERNESS", "DISTRICT_WONDER", ""]) {
    const v = evaluateTile({ districtType: d, constructibles: [c()] }, AGE);
    assert.equal(v.eligible, false, d + " should be refused");
    assert.equal(v.reason, REASON.NOT_URBAN, d + " should read not-urban");
  }
});

test("a missing tile is refused rather than throwing", () => {
  assert.equal(evaluateTile(null, AGE).eligible, false);
  assert.equal(evaluateTile(undefined, AGE).reason, REASON.NOT_URBAN);
});

// emptiness

test("an empty urban district is refused", () => {
  assert.equal(evaluateTile(urban(), AGE).reason, REASON.EMPTY);
  assert.equal(evaluateTile({ districtType: "DISTRICT_URBAN", constructibles: null }, AGE).reason, REASON.EMPTY);
});

// walls

test("a wall neither blocks nor counts: the tile is eligible, the wall is listed to be kept", () => {
  const v = evaluateTile(
    urban(c({ type: "BUILDING_LIBRARY" }), c({ type: "BUILDING_ANCIENT_WALLS", existingDistrictOnly: true })),
    AGE,
  );
  assert.equal(v.eligible, true);
  assert.deepEqual(v.outdated, ["BUILDING_LIBRARY"]);
  assert.deepEqual(v.walls, ["BUILDING_ANCIENT_WALLS"]);
  assert.deepEqual(v.blockers, []);
});

test("a wall on an otherwise empty tile is not a clear target", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_ANCIENT_WALLS", existingDistrictOnly: true })), AGE);
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.EMPTY);
});

test("a wall beside a current-age building still refuses for the building", () => {
  const v = evaluateTile(
    urban(c({ type: "BUILDING_ANCIENT_WALLS", existingDistrictOnly: true }), c({ type: "BUILDING_BANK", age: AGE })),
    AGE,
  );
  assert.equal(v.reason, REASON.CURRENT_AGE);
  assert.deepEqual(v.walls, ["BUILDING_ANCIENT_WALLS"]);
});

test("the three tile shapes the design names: one outdated yes, several outdated yes, mixed no, two current no", () => {
  assert.equal(evaluateTile(urban(c({ type: "A" })), AGE).eligible, true);
  assert.equal(evaluateTile(urban(c({ type: "A" }), c({ type: "B" })), AGE).eligible, true);
  assert.equal(evaluateTile(urban(c({ type: "A" }), c({ type: "B", age: AGE })), AGE).eligible, false);
  assert.equal(evaluateTile(urban(c({ type: "A", age: AGE }), c({ type: "B", age: AGE })), AGE).eligible, false);
});

// malformed input

test("a constructible with no age blocks rather than being assumed outdated", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_MYSTERY", age: null })), AGE);
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.UNKNOWN_AGE);
  assert.deepEqual(v.blockers, ["BUILDING_MYSTERY"]);
});

test("a junk entry blocks rather than being skipped", () => {
  const v = evaluateTile({ districtType: "DISTRICT_URBAN", constructibles: [null] }, AGE);
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.UNKNOWN_AGE);
});

// notes

test("a damaged outdated building is still eligible but is called out", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_BATH", damaged: true })), AGE);
  assert.equal(v.eligible, true);
  assert.equal(v.notes.length, 1);
  assert.match(v.notes[0], /BUILDING_BATH is damaged/);
});

// the stricter rule from the Options screen: two ages back

const ORDER = ["AGE_ANTIQUITY", "AGE_EXPLORATION", "AGE_MODERN"];
const MODERN = "AGE_MODERN";
const TWO_BACK = { agesBack: 2, ageOrder: ORDER };

test("two ages back: an Antiquity tile in the Modern age is eligible", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_LIBRARY", age: "AGE_ANTIQUITY" })), MODERN, TWO_BACK);
  assert.equal(v.eligible, true);
  assert.deepEqual(v.outdated, ["BUILDING_LIBRARY"]);
});

test("two ages back: an Exploration building in the Modern age blocks the tile and is named", () => {
  const v = evaluateTile(
    urban(c({ type: "BUILDING_LIBRARY", age: "AGE_ANTIQUITY" }), c({ type: "BUILDING_BANK", age: "AGE_EXPLORATION" })),
    MODERN, TWO_BACK,
  );
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.TOO_RECENT);
  assert.deepEqual(v.blockers, ["BUILDING_BANK"]);
});

test("two ages back: in the Exploration age nothing is far enough back", () => {
  const v = evaluateTile(urban(c({ age: "AGE_ANTIQUITY" })), "AGE_EXPLORATION", TWO_BACK);
  assert.equal(v.eligible, false);
  assert.equal(v.reason, REASON.TOO_RECENT);
});

test("two ages back: Ageless and current-age keep their own reasons, walls are still kept", () => {
  const ageless = evaluateTile(urban(c({ age: "AGE_ANTIQUITY", ageless: true })), MODERN, TWO_BACK);
  assert.equal(ageless.reason, REASON.AGELESS);
  const current = evaluateTile(urban(c({ age: MODERN })), MODERN, TWO_BACK);
  assert.equal(current.reason, REASON.CURRENT_AGE);
  const walled = evaluateTile(
    urban(c({ age: "AGE_ANTIQUITY" }), c({ type: "BUILDING_DEFENSIVE_FORTIFICATIONS", age: MODERN, existingDistrictOnly: true })),
    MODERN, TWO_BACK,
  );
  assert.equal(walled.eligible, true);
  assert.deepEqual(walled.walls, ["BUILDING_DEFENSIVE_FORTIFICATIONS"]);
});

test("two ages back: an age missing from the order blocks rather than guessing", () => {
  const unknownAge = evaluateTile(urban(c({ age: "AGE_MYSTERY" })), MODERN, TWO_BACK);
  assert.equal(unknownAge.reason, REASON.UNKNOWN_AGE);
  const noOrder = evaluateTile(urban(c({ age: "AGE_ANTIQUITY" })), MODERN, { agesBack: 2 });
  assert.equal(noOrder.reason, REASON.UNKNOWN_AGE);
  const notNow = evaluateTile(urban(c({ age: "AGE_ANTIQUITY" })), "AGE_FUTURE", TWO_BACK);
  assert.equal(notNow.reason, REASON.UNKNOWN_AGE);
});

test("one age back, or no rule at all, is the shipped rule and needs no age order", () => {
  for (const rule of [undefined, {}, { agesBack: 1 }, { agesBack: 1, ageOrder: [] }]) {
    assert.equal(evaluateTile(urban(c({ age: "AGE_EXPLORATION" })), MODERN, rule).eligible, true);
    assert.equal(evaluateTile(urban(c({ age: MODERN })), MODERN, rule).reason, REASON.CURRENT_AGE);
  }
});

test("isOutdated follows the rule it is given", () => {
  assert.equal(isOutdated(c({ age: "AGE_EXPLORATION" }), MODERN), true);
  assert.equal(isOutdated(c({ age: "AGE_EXPLORATION" }), MODERN, TWO_BACK), false);
  assert.equal(isOutdated(c({ age: "AGE_ANTIQUITY" }), MODERN, TWO_BACK), true);
});

// Wonders the mod leaves out: rows shaped as the compiled 1.5.0 gameplay database holds them

/** @returns {object} A neighbour with sensible defaults: flat grassland, no district, nothing on it. */
const nb = (over = {}) => ({
  terrain: "TERRAIN_FLAT", biome: "BIOME_GRASSLAND", district: "", districtClass: "", types: [], water: false,
  lake: false, resource: "", capital: false, ...over,
});
/** @returns {object} A site: flat grassland, no feature, six empty neighbours. */
const site = (over = {}, ...neighbours) => ({
  terrain: "TERRAIN_FLAT", biome: "BIOME_GRASSLAND", feature: "", featureClass: "", resource: "", river: false,
  water: false, lake: false, adjacentToLand: null, distantLands: false,
  neighbours: neighbours.length ? neighbours : [nb(), nb(), nb(), nb(), nb(), nb()],
  countInSettlement: () => 0, ...over,
});
/** @returns {object} Rules for a Wonder: a Constructibles row, a Wonders row, and table rows. */
const rules = (def = {}, wonder = {}, rows = {}) => ({
  def: { ConstructibleType: "WONDER_TEST", ...def }, wonder: wonder === null ? null : { ConstructibleType: "WONDER_TEST", ...wonder }, rows,
});
const urbanNb = (cls = "URBAN", type = "DISTRICT_URBAN") => nb({ district: type, districtClass: cls });

test("a Wonder with no placement rule accepts any land site", () => {
  assert.deepEqual(fitsPlacement(rules(), site()), { ok: true, failed: null });
  assert.deepEqual(fitsPlacement(rules({}, null), site()), { ok: true, failed: null });
});

test("a missing row or site is refused", () => {
  assert.equal(fitsPlacement(null, site()).failed, "Constructibles");
  assert.equal(fitsPlacement(rules(), null).failed, "Site");
});

test("terrain and biome rows", () => {
  const r = rules({}, {}, { ValidTerrains: ["TERRAIN_FLAT"], ValidBiomes: ["BIOME_GRASSLAND", "BIOME_PLAINS"] });
  assert.equal(fitsPlacement(r, site()).ok, true);
  assert.equal(fitsPlacement(r, site({ terrain: "TERRAIN_HILL" })).failed, "ValidTerrains");
  assert.equal(fitsPlacement(r, site({ biome: "BIOME_TUNDRA" })).failed, "ValidBiomes");
});

test("the feature tables: none, valid, required, a required class (Ubudiah Mosque's wet feature), invalid", () => {
  assert.equal(fitsPlacement(rules({ NoFeature: 1 }), site({ feature: "FEATURE_FOREST" })).failed, "NoFeature");
  assert.equal(fitsPlacement(rules({ NoFeature: 1 }), site()).ok, true);
  const valid = rules({}, {}, { ValidFeatures: ["FEATURE_FOREST"] });
  assert.equal(fitsPlacement(valid, site({ feature: "FEATURE_FOREST" })).ok, true);
  assert.equal(fitsPlacement(valid, site()).failed, "ValidFeatures");
  const required = rules({}, {}, { RequiredFeatures: ["FEATURE_OASIS"] });
  assert.equal(fitsPlacement(required, site({ feature: "FEATURE_MARSH" })).failed, "RequiredFeatures");
  const ubudiah = rules({ ConstructibleType: "WONDER_UBUDIAH_MOSQUE" }, {}, { RequiredFeatureClasses: ["FEATURE_CLASS_WET"] });
  assert.equal(fitsPlacement(ubudiah, site({ feature: "FEATURE_MARSH", featureClass: "FEATURE_CLASS_WET" })).ok, true);
  assert.equal(fitsPlacement(ubudiah, site({ feature: "FEATURE_FOREST", featureClass: "FEATURE_CLASS_VEGETATED" })).failed, "RequiredFeatureClasses");
  assert.equal(fitsPlacement(ubudiah, site()).failed, "RequiredFeatureClasses");
  const invalid = rules({}, {}, { InvalidFeatures: ["FEATURE_FOREST"] });
  assert.equal(fitsPlacement(invalid, site({ feature: "FEATURE_FOREST" })).failed, "InvalidFeatures");
  assert.equal(fitsPlacement(invalid, site()).ok, true);
});

test("the resource table", () => {
  const r = rules({}, {}, { ValidResources: ["RESOURCE_SALT"] });
  assert.equal(fitsPlacement(r, site({ resource: "RESOURCE_SALT" })).ok, true);
  assert.equal(fitsPlacement(r, site()).failed, "ValidResources");
});

test("river flags and river placement", () => {
  assert.equal(fitsPlacement(rules({ AdjacentRiver: 1 }), site({ river: true })).ok, true);
  assert.equal(fitsPlacement(rules({ AdjacentRiver: 1 }), site({ river: null })).failed, "AdjacentRiver");
  assert.equal(fitsPlacement(rules({ NoRiver: 1 }), site({ river: true })).failed, "NoRiver");
  assert.equal(fitsPlacement(rules({ RiverPlacement: "RIVER" }), site({ river: true })).ok, true);
  assert.equal(fitsPlacement(rules({ RiverPlacement: "RIVER" }), site()).failed, "RiverPlacement");
  const statue = rules({ ConstructibleType: "WONDER_STATUE_OF_LIBERTY", RiverPlacement: "ANCHORED" });
  assert.equal(fitsPlacement(statue, site({ water: true, adjacentToLand: true })).ok, true);
  assert.equal(fitsPlacement(statue, site({ water: true, adjacentToLand: false })).failed, "RiverPlacement");
  assert.equal(fitsPlacement(statue, site()).failed, "RiverPlacement");
  assert.equal(fitsPlacement(rules({ RiverPlacement: "OFF_COAST" }), site({ water: true, adjacentToLand: true })).ok, true);
  assert.equal(fitsPlacement(rules({ RiverPlacement: "SOMETHING_NEW" }), site({ river: true })).failed, "RiverPlacement");
});

test("lake flags", () => {
  assert.equal(fitsPlacement(rules({}, { MustBeLake: 1 }), site({ water: true, lake: true })).ok, true);
  assert.equal(fitsPlacement(rules({}, { MustBeLake: 1 }), site()).failed, "MustBeLake");
  assert.equal(fitsPlacement(rules({}, { MustNotBeLake: 1 }), site({ water: true, lake: true })).failed, "MustNotBeLake");
  assert.equal(fitsPlacement(rules({}, { MustNotBeLake: 1 }), site({ water: true })).ok, true);
});

test("homeland and distant lands", () => {
  assert.equal(fitsPlacement(rules({ RequiresHomeland: 1 }), site({ distantLands: false })).ok, true);
  assert.equal(fitsPlacement(rules({ RequiresHomeland: 1 }), site({ distantLands: true })).failed, "RequiresHomeland");
  assert.equal(fitsPlacement(rules({ RequiresDistantLands: 1 }), site({ distantLands: true })).ok, true);
  assert.equal(fitsPlacement(rules({ RequiresDistantLands: 1 }), site({ distantLands: false })).failed, "RequiresDistantLands");
  assert.equal(fitsPlacement(rules({ RequiresDistantLands: 1 }), site({ distantLands: null })).ok, false);
});

test("neighbour terrain, district, biomes, mountain, constructible, capital and resource", () => {
  assert.equal(fitsPlacement(rules({ AdjacentTerrain: "TERRAIN_COAST" }), site({}, nb({ terrain: "TERRAIN_COAST", water: true }))).ok, true);
  assert.equal(fitsPlacement(rules({ AdjacentTerrain: "TERRAIN_COAST" }), site()).failed, "AdjacentTerrain");
  assert.equal(fitsPlacement(rules({ AdjacentDistrict: "DISTRICT_URBAN" }), site({}, urbanNb())).ok, true);
  assert.equal(fitsPlacement(rules({ AdjacentDistrict: "DISTRICT_URBAN" }), site()).failed, "AdjacentDistrict");
  const biomes = rules({}, {}, { InvalidAdjacentBiomes: ["BIOME_TUNDRA"] });
  assert.equal(fitsPlacement(biomes, site({}, nb({ biome: "BIOME_TUNDRA" }))).failed, "InvalidAdjacentBiomes");
  assert.equal(fitsPlacement(biomes, site()).ok, true);
  assert.equal(fitsPlacement(rules({}, { AdjacentToMountain: 1 }), site({}, nb({ terrain: "TERRAIN_MOUNTAIN" }))).ok, true);
  assert.equal(fitsPlacement(rules({}, { AdjacentToMountain: 1 }), site()).failed, "AdjacentToMountain");
  const next = rules({}, { AdjacentConstructible: "BUILDING_LIBRARY" });
  assert.equal(fitsPlacement(next, site({}, nb({ types: ["BUILDING_LIBRARY"] }))).ok, true);
  assert.equal(fitsPlacement(next, site()).failed, "AdjacentConstructible");
  assert.equal(fitsPlacement(rules({}, { AdjacentCapital: 1 }), site({}, nb({ capital: true }))).ok, true);
  assert.equal(fitsPlacement(rules({}, { AdjacentCapital: 1 }), site()).failed, "AdjacentCapital");
  assert.equal(fitsPlacement(rules({}, { AdjacentResource: "RESOURCE_SALT" }), site({}, nb({ resource: "RESOURCE_SALT" }))).ok, true);
  assert.equal(fitsPlacement(rules({}, { AdjacentResource: "RESOURCE_SALT" }), site()).failed, "AdjacentResource");
});

test("lake adjacency (Shwedagon Zedi Daw, Muzibu Azaala Mpanga): one lake among the six neighbours", () => {
  const r = rules({ ConstructibleType: "WONDER_SHWEDAGON_ZEDI_DAW", AdjacentLake: 1 });
  assert.equal(fitsPlacement(r, site({}, nb({ terrain: "TERRAIN_COAST", water: true, lake: true }))).ok, true);
  assert.equal(fitsPlacement(r, site({}, nb({ terrain: "TERRAIN_COAST", water: true }))).failed, "AdjacentLake");
  assert.equal(fitsPlacement(r, site()).failed, "AdjacentLake");
});

test("the frontier rule (Rila Monastery): no built-up district beside the site; rural tiles and open land are fine", () => {
  const rila = rules({ ConstructibleType: "WONDER_RILA_MONASTERY" }, { BuildOnFrontier: 1 });
  assert.deepEqual(FRONTIER_DISTRICT_CLASSES, ["URBAN", "CITYCENTER", "WONDER"]);
  assert.equal(fitsPlacement(rila, site()).ok, true);
  assert.equal(fitsPlacement(rila, site({}, urbanNb("RURAL", "DISTRICT_RURAL"), urbanNb("WILDERNESS", "DISTRICT_WILDERNESS"))).ok, true);
  assert.equal(fitsPlacement(rila, site({}, urbanNb())).failed, "BuildOnFrontier");
  assert.equal(fitsPlacement(rila, site({}, urbanNb("CITYCENTER", "DISTRICT_CITY_CENTER"))).failed, "BuildOnFrontier");
  assert.equal(fitsPlacement(rila, site({}, urbanNb("WONDER", "DISTRICT_WONDER"))).failed, "BuildOnFrontier");
  // The site's own district is never looked at: it is the tile being cleared.
  assert.equal(fitsPlacement(rila, site({ district: "DISTRICT_URBAN" })).ok, true);
});

test("beside land: a land tile with any land neighbour, a water tile by the engine's own answer", () => {
  const r = rules({}, { AdjacentToLand: 1 });
  assert.equal(fitsPlacement(r, site()).ok, true);
  assert.equal(fitsPlacement(r, site({}, nb({ water: true }), nb({ water: true }))).failed, "AdjacentToLand");
  assert.equal(fitsPlacement(r, site({ water: true, adjacentToLand: true })).ok, true);
  assert.equal(fitsPlacement(r, site({ water: true, adjacentToLand: false })).failed, "AdjacentToLand");
  assert.equal(fitsPlacement(r, site({ water: true, adjacentToLand: null })).failed, "AdjacentToLand");
  // Battersea Power Station: a land Wonder beside Coast and beside land.
  const battersea = rules({ ConstructibleType: "WONDER_BATTERSEA_POWER_STATION", AdjacentTerrain: "TERRAIN_COAST" }, { AdjacentToLand: 1 });
  assert.equal(fitsPlacement(battersea, site({}, nb({ terrain: "TERRAIN_COAST", water: true }), nb())).ok, true);
  assert.equal(fitsPlacement(battersea, site()).failed, "AdjacentTerrain");
});

test("a required constructible in the settlement, with a count", () => {
  const r = rules({}, { RequiredConstructibleInSettlement: "BUILDING_LIBRARY", RequiredConstructibleInSettlementCount: 2 });
  assert.equal(fitsPlacement(r, site({ countInSettlement: (t) => (t === "BUILDING_LIBRARY" ? 2 : 0) })).ok, true);
  assert.equal(fitsPlacement(r, site({ countInSettlement: () => 1 })).failed, "RequiredConstructibleInSettlement");
  const one = rules({}, { RequiredConstructibleInSettlement: "BUILDING_LIBRARY" });
  assert.equal(fitsPlacement(one, site({ countInSettlement: () => 1 })).ok, true);
});

test("appeal placement, which no Wonder carries, refuses rather than guesses", () => {
  assert.equal(fitsPlacement(rules({ RequiresAppealPlacement: 1 }), site()).failed, "RequiresAppealPlacement");
});

test("the first failed rule is named in table order", () => {
  const r = rules({ AdjacentLake: 1 }, { BuildOnFrontier: 1 }, { ValidTerrains: ["TERRAIN_HILL"] });
  assert.equal(fitsPlacement(r, site({}, urbanNb())).failed, "ValidTerrains");
  assert.equal(fitsPlacement(r, site({ terrain: "TERRAIN_HILL" }, urbanNb())).failed, "AdjacentLake");
  assert.equal(PLACEMENT_TABLES.length, 8);
});

// collection + description

test("eligibleTiles keeps only the eligible plots and carries the plot index", () => {
  const out = eligibleTiles(
    [
      { plot: 10, tile: urban(c()) },
      { plot: 11, tile: urban(c({ age: AGE })) },
      { plot: 12, tile: { districtType: "DISTRICT_RURAL", constructibles: [c()] } },
      null,
    ],
    AGE,
  );
  assert.deepEqual(out.map((e) => e.plot), [10]);
  assert.equal(out[0].verdict.eligible, true);
});

test("eligibleTiles tolerates a non-array", () => {
  assert.deepEqual(eligibleTiles(null, AGE), []);
});

test("describeVerdict names what would be destroyed, what is kept, and why not when refused", () => {
  const yes = describeVerdict(7, evaluateTile(urban(c({ type: "BUILDING_LIBRARY" })), AGE));
  assert.match(yes, /plot 7: ELIGIBLE, would destroy \[BUILDING_LIBRARY\]/);
  const kept = describeVerdict(6, evaluateTile(urban(c({ type: "BUILDING_LIBRARY" }), c({ type: "BUILDING_ANCIENT_WALLS", existingDistrictOnly: true })), AGE));
  assert.match(kept, /keeping walls \[BUILDING_ANCIENT_WALLS\]/);
  const no = describeVerdict(8, evaluateTile(urban(c({ age: AGE, type: "BUILDING_BANK" })), AGE));
  assert.match(no, /plot 8: no \(has-current-age\) blocked by \[BUILDING_BANK\]/);
  assert.match(describeVerdict(9, null), /no verdict/);
});

// run

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error("FAIL  " + name + "\n      " + (e && e.message));
  }
}
console.log(`${passed}/${cases.length} eligibility tests passed`);
if (failed) process.exit(1);
