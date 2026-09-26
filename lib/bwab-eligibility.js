// bwab-eligibility.js
//
// "Is this tile one a Wonder may take over?" -- the single rule, with no engine in it.
//
// Pure on purpose. It takes plain descriptors and returns a verdict, so the same rule can be
// unit-tested offline (tests/eligibility.mjs), read by the Route B probe before it destroys
// anything, and later reused by the mod itself. Nothing here calls GameInfo, Districts or
// MapConstructibles; the caller does that and hands the results in.
//
// The rule is the ENGINE's rule, restated, not a new one:
//   a constructible is outdated when its Age is not the current age and it is not AGELESS.
// That is what BuildingPlacementManager.willBecomeQuarter checks, inverted.
//
// Conservative by construction. The failure mode this feeds is destructive and irreversible
// (see DESIGN.md 7b -- a stranded district produced an unusable plot once already), so every
// uncertain case resolves to "not eligible" with a reason, never to "probably fine".

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

/** The only district a tile may be taken from. Not the city center -- see DESIGN.md 6.4. */
export const ELIGIBLE_DISTRICT = "DISTRICT_URBAN";

/** Reason codes. Stable strings: the probe logs them and the observation sheet quotes them. */
export const REASON = Object.freeze({
  OK: "ok",
  NOT_URBAN: "not-urban",
  EMPTY: "empty",
  CURRENT_AGE: "has-current-age",
  AGELESS: "has-ageless",
  UNKNOWN_AGE: "has-unknown-age",
});

/**
 * Whether one constructible counts as outdated, by the engine's own definition.
 * A type with no age is never outdated: it cannot be compared, so it is left alone.
 * @param {ConstructibleInfo} c The constructible.
 * @param {string} currentAge The current AgeType.
 * @returns {boolean} True when the engine would treat it as overbuildable.
 */
export function isOutdated(c, currentAge) {
  if (!c || c.ageless) return false;
  if (typeof c.age !== "string" || c.age === "") return false;
  return c.age !== currentAge;
}

/**
 * Judge one tile.
 *
 * Refuses, in this order: a district that is not urban; a tile with nothing (that houses anyone)
 * on it; a tile holding anything not outdated. Walls (`ExistingDistrictOnly`) neither block nor
 * count: they are listed in `walls` so the caller can keep them, which is the design decision --
 * clearing a tile must not cost the city its defenses.
 *
 * So: one outdated building, or several, qualifies. One outdated beside one current-age does not.
 * Two current-age do not. Anything Ageless does not.
 *
 * @param {TileInfo} tile
 * @param {string} currentAge The current AgeType.
 * @returns {Verdict} The verdict.
 */
export function evaluateTile(tile, currentAge) {
  /** @type {string[]} */ const outdated = [];
  /** @type {string[]} */ const walls = [];
  /** @type {string[]} */ const blockers = [];
  /** @type {string[]} */ const notes = [];
  /** @param {boolean} eligible @param {string} reason @returns {Verdict} */
  const verdict = (eligible, reason) => ({ eligible, reason, outdated, walls, blockers, notes });

  if (!tile || tile.districtType !== ELIGIBLE_DISTRICT) return verdict(false, REASON.NOT_URBAN);

  const list = Array.isArray(tile.constructibles) ? tile.constructibles : [];
  if (list.length === 0) return verdict(false, REASON.EMPTY);

  /** @type {string} */ let reason = REASON.OK;
  const fail = (/** @type {string} */ code) => {
    // Keep the first refusal: the order above is the order a reader expects to hear it in.
    if (reason === REASON.OK) reason = code;
  };

  for (const c of list) {
    if (!c || typeof c.type !== "string") {
      blockers.push(String(c && c.type));
      fail(REASON.UNKNOWN_AGE);
      continue;
    }
    if (c.existingDistrictOnly) {
      walls.push(c.type);
      continue;
    }
    if (c.ageless) {
      blockers.push(c.type);
      fail(REASON.AGELESS);
      continue;
    }
    if (typeof c.age !== "string" || c.age === "") {
      blockers.push(c.type);
      fail(REASON.UNKNOWN_AGE);
      continue;
    }
    if (c.age === currentAge) {
      blockers.push(c.type);
      fail(REASON.CURRENT_AGE);
      continue;
    }
    outdated.push(c.type);
    // A damaged building can still be repaired; destroying it throws that away. Worth saying,
    // not worth refusing over.
    if (c.damaged) notes.push(c.type + " is damaged (repairable; demolishing forfeits that)");
  }

  if (reason !== REASON.OK) return verdict(false, reason);
  if (outdated.length === 0) return verdict(false, REASON.EMPTY);
  return verdict(true, REASON.OK);
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
 * A one-line human summary of a verdict, for a log or the observation sheet.
 * @param {number} plot The plot index.
 * @param {Verdict} v The verdict.
 * @returns {string} The line.
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
