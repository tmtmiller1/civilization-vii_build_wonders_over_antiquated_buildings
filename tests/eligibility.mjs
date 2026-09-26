// Offline tests for lib/bwab-eligibility.js.
//
// The module is deliberately engine-free, so these run under plain node with no loader and no
// stubs: `npm test` from the mod root.
//
// What these DO prove: the rule refuses every case it should, in the order it should, and names
// the right blockers. What they do NOT prove: that the engine behaves as DESIGN.md 7b assumes.
// No test in this file touches the game.

import assert from "node:assert/strict";
import { evaluateTile, eligibleTiles, isOutdated, describeVerdict, REASON } from "../lib/bwab-eligibility.js";

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
/** Register a named check. */
const test = (name, fn) => cases.push([name, fn]);

// --- isOutdated ------------------------------------------------------------------------------

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

// --- the four player-facing cases from DESIGN.md 1 --------------------------------------------

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

// --- the district gate ------------------------------------------------------------------------

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

// --- emptiness ---------------------------------------------------------------------------------

test("an empty urban district is refused", () => {
  assert.equal(evaluateTile(urban(), AGE).reason, REASON.EMPTY);
  assert.equal(evaluateTile({ districtType: "DISTRICT_URBAN", constructibles: null }, AGE).reason, REASON.EMPTY);
});

// --- walls --------------------------------------------------------------------------------------

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

// --- malformed input ------------------------------------------------------------------------------

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

// --- notes ----------------------------------------------------------------------------------------

test("a damaged outdated building is still eligible but is called out", () => {
  const v = evaluateTile(urban(c({ type: "BUILDING_BATH", damaged: true })), AGE);
  assert.equal(v.eligible, true);
  assert.equal(v.notes.length, 1);
  assert.match(v.notes[0], /BUILDING_BATH is damaged/);
});

// --- collection + description ---------------------------------------------------------------------

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

// --- run -------------------------------------------------------------------------------------------

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
