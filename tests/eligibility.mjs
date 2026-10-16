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
  evaluateTile, eligibleTiles, isOutdated, describeVerdict, unreadRule, REASON, UNREAD_TABLES,
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

const noRows = () => false;
const rowsIn = (...tables) => (table) => tables.includes(table);

test("a Wonder whose every rule the mod checks isn't left out", () => {
  const def = { ConstructibleType: "WONDER_ANGKOR_WAT", AdjacentRiver: 1, AdjacentLake: 0, RequiresAppealPlacement: 0, RiverPlacement: null };
  assert.equal(unreadRule(def, { MaxWorldInstances: 1, BuildOnFrontier: 0 }, noRows), null);
  assert.equal(unreadRule(def, null, noRows), null);
});

test("lake adjacency and appeal leave a Wonder out", () => {
  assert.equal(unreadRule({ ConstructibleType: "WONDER_SHWEDAGON_ZEDI_DAW", AdjacentLake: 1 }, {}, noRows), "AdjacentLake");
  assert.equal(unreadRule({ RequiresAppealPlacement: 1 }, {}, noRows), "RequiresAppealPlacement");
});

test("river placement leaves the Statue of Liberty out", () => {
  assert.equal(unreadRule({ ConstructibleType: "WONDER_STATUE_OF_LIBERTY", RiverPlacement: "ANCHORED" }, {}, noRows), "RiverPlacement");
});

test("a feature or resource row leaves a Wonder out, Ubudiah Mosque's wet feature class among them", () => {
  const ubudiah = { ConstructibleType: "WONDER_UBUDIAH_MOSQUE" };
  assert.equal(unreadRule(ubudiah, {}, rowsIn("Constructible_RequiredFeatureClasses")), "Constructible_RequiredFeatureClasses");
  for (const table of UNREAD_TABLES) assert.equal(unreadRule({}, {}, rowsIn(table)), table);
  assert.equal(unreadRule({}, {}, rowsIn("Constructible_ValidTerrains", "Constructible_ValidBiomes")), null);
});

test("BuildOnFrontier leaves Rila Monastery out (it can't stand next to a district)", () => {
  const rila = { ConstructibleType: "WONDER_RILA_MONASTERY", AdjacentLake: 0, RequiresAppealPlacement: 0, RiverPlacement: null };
  assert.equal(unreadRule(rila, { ConstructibleType: "WONDER_RILA_MONASTERY", MaxWorldInstances: 1, BuildOnFrontier: 1 }, noRows), "BuildOnFrontier");
});

test("a missing Constructibles row leaves the Wonder out", () => {
  assert.equal(unreadRule(null, null, noRows), "Constructibles");
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
