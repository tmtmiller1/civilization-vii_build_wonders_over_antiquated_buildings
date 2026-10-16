// bwab-settings.js
//
// The player's two choices (docs/OPTIONS.md): whether antiquated tiles are offered at all, and how old a building has
// to be to count as antiquated.
//
// The values live in the shared "modSettings" localStorage entry under the mod's id, the store Tower's other mods use
// (settings-keeper.js keeps it readable across a restart). They're the player's preference, so none of it goes into
// the save. That entry holds every mod's data and one read costs several milliseconds, while the canStart wrap asks
// once per production-list item. So the values are read once, kept here, and read again only when something may have
// changed: refreshSettings() for that, and a write here updates the copy in memory and sends SETTINGS_CHANGED_EVENT
// on the window.
//
// No imports, so the Options screen can load it in the main menu and the tests can load it under plain node.

export const MOD_ID = "tower-build-wonders-over-antiquated-buildings";
export const SETTINGS_CHANGED_EVENT = "bwab-settings-changed";

/** The "Antiquated means" choices, in the order the dropdown lists them, and how many ages back each one asks for. */
export const RULES = Object.freeze([
  Object.freeze({ id: "earlier", agesBack: 1 }),
  Object.freeze({ id: "two-ages", agesBack: 2 }),
]);

/**
 * @typedef {object} Settings
 * @property {boolean} enabled Whether antiquated tiles are offered at all.
 * @property {string} rule One of the RULES ids.
 * @property {number} agesBack How many ages back a building has to be: 1 or 2.
 */

/** @type {Settings|null} */
let current = null;

/** @returns {Record<string, *>} The mod's section of the shared entry, or {} when there is none or it can't be read. */
function readSection() {
  try {
    const section = JSON.parse(localStorage.getItem("modSettings") || "null")?.[MOD_ID];
    return section && typeof section === "object" && !Array.isArray(section) ? section : {};
  } catch (_) {
    return {};
  }
}

/** @param {Record<string, *>} section @returns {Settings} The stored values, with a default for anything missing. */
function resolve(section) {
  const rule = RULES.find((r) => r.id === section.rule) || RULES[0];
  return Object.freeze({ enabled: section.enabled !== false, rule: rule.id, agesBack: rule.agesBack });
}

/** @returns {Settings} The values in play. Reads the store the first time only. */
export function getSettings() {
  if (!current) current = resolve(readSection());
  return current;
}

/** Read the store again, for when another script context may have written it. @returns {Settings} */
export function refreshSettings() {
  current = resolve(readSection());
  return current;
}

/**
 * The shared entry, for a write. getItem() can return the first key in the store instead of the one asked for, so a
 * write goes ahead only when what came back looks like a settings root ({ "<modId>": {...}, ... }), never over
 * another mod's data.
 * @returns {{root: Record<string, *>, safe: boolean}}
 */
function sharedForWrite() {
  let raw = null;
  try {
    raw = localStorage.getItem("modSettings");
    if (!raw) raw = localStorage.getItem("modSettings"); // a first read can come back empty
  } catch (_) {
    return { root: {}, safe: false };
  }
  if (!raw) return { root: {}, safe: true };
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return { root: {}, safe: false };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { root: {}, safe: false };
  const root = Object.keys(parsed).every((k) => !!parsed[k] && typeof parsed[k] === "object" && !Array.isArray(parsed[k]));
  return root ? { root: parsed, safe: true } : { root: {}, safe: false };
}

/**
 * Store one value and apply it. When the store can't be written safely the choice still holds for this session; it
 * just won't be there after a restart.
 * @param {string} key @param {*} value
 */
function write(key, value) {
  const now = getSettings();
  /** @type {Record<string, *>} */
  let section = { enabled: now.enabled, rule: now.rule, [key]: value };
  try {
    const { root, safe } = sharedForWrite();
    if (safe) {
      section = { ...(root[MOD_ID] || {}), [key]: value };
      root[MOD_ID] = section;
      localStorage.setItem("modSettings", JSON.stringify(root));
    } else {
      console.warn("[BWAB] modSettings didn't read back as a settings store; " + key + " applies until you quit");
    }
  } catch (_) {
    /* the value still applies below */
  }
  current = resolve(section);
  try {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { key } }));
  } catch (_) {
    /* no window */
  }
}

/** @param {boolean} on Whether antiquated tiles are offered at all. */
export function setEnabled(on) {
  write("enabled", !!on);
}

/** @param {string} id One of the RULES ids; anything else is ignored. */
export function setRule(id) {
  if (RULES.some((r) => r.id === id)) write("rule", id);
}
