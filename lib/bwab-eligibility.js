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
// unreadRule, below evaluateTile, is the other half of the offer: which Wonders carry a placement rule the mod doesn't
// evaluate and so are never offered a cleared tile.
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
 * The Constructible_* tables a Wonder can hold rows in that the mod reads but doesn't evaluate: the feature tables and
 * the resource table. No 1.5.0 Wonder has a row in any of them except Ubudiah Mosque (a wet feature class).
 */
export const UNREAD_TABLES = Object.freeze([
  "Constructible_ValidFeatures", "Constructible_RequiredFeatures", "Constructible_RequiredFeatureClasses",
  "Constructible_InvalidFeatures", "Constructible_ValidResources",
]);

/**
 * The first placement rule a Wonder carries that the mod doesn't evaluate, or null when it carries none. A Wonder with
 * one is left out rather than guessed at, so an answer here only ever makes the mod more careful.
 *
 * In the compiled 1.5.0 data: Shwedagon Zedi Daw and Muzibu Azaala Mpanga (AdjacentLake), the Statue of Liberty
 * (RiverPlacement), Ubudiah Mosque (Constructible_RequiredFeatureClasses), and Vix and Rila Monastery
 * (BuildOnFrontier, "Cannot be placed adjacent to a District"; Vix is an Antiquity Wonder, when nothing is antiquated).
 * @param {{AdjacentLake?: *, RequiresAppealPlacement?: *, RiverPlacement?: *}|null} def The Constructibles row.
 * @param {{BuildOnFrontier?: *}|null} wonder The Wonders row, or null when there is none.
 * @param {(table: string) => boolean} hasRows Whether the named table holds a row for this Wonder.
 * @returns {string|null} The rule's column or table name.
 */
export function unreadRule(def, wonder, hasRows) {
  if (!def) return "Constructibles";
  if (def.AdjacentLake) return "AdjacentLake";
  if (def.RequiresAppealPlacement) return "RequiresAppealPlacement";
  if (def.RiverPlacement) return "RiverPlacement";
  if (wonder && wonder.BuildOnFrontier) return "BuildOnFrontier";
  return UNREAD_TABLES.find((table) => hasRows(table)) || null;
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
