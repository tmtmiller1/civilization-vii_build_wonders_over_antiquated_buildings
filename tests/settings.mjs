// Offline tests for ui/bwab-settings.js.
//
// The module has no imports and touches only localStorage and window, so these run under plain node with a stand-in
// for each: `npm test` from the mod root. Each test loads a fresh copy of the module (a query string makes node run
// the file again), so the read-once cache starts empty every time.
//
// They cover what docs/OPTIONS.md promises: the defaults, one store read for any number of lookups, the write that
// keeps every other mod's section, the guard that refuses to write over a store that isn't a settings root, and the
// refresh that picks up a write from elsewhere.

import assert from "node:assert/strict";

const MOD = "tower-build-wonders-over-antiquated-buildings";

/** A localStorage stand-in holding one row, counting reads and writes. @param {string|null} initial */
function fakeStorage(initial) {
  const store = {
    row: initial, reads: 0, writes: 0, throws: false,
    getItem() {
      store.reads++;
      if (store.throws) throw new Error("storage unavailable");
      return store.row;
    },
    setItem(_key, value) {
      store.writes++;
      store.row = String(value);
    },
  };
  return store;
}

/** The events the module sends on window. */
const events = [];
globalThis.window = { dispatchEvent: (e) => { events.push(e); return true; } };

let fresh = 0;
/** @param {string|null} row The modSettings row to start from. */
async function load(row) {
  const storage = fakeStorage(row);
  globalThis.localStorage = storage;
  events.length = 0;
  const mod = await import("../ui/bwab-settings.js?fresh=" + ++fresh);
  return { mod, storage };
}

const stored = (storage) => JSON.parse(storage.row);

/** Run fn with the module's expected warning kept out of the test output. */
function quietly(fn) {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
  }
}

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

test("an empty store reads as the defaults: on, any earlier age", async () => {
  const { mod } = await load(null);
  assert.deepEqual({ ...mod.getSettings() }, { enabled: true, rule: "earlier", agesBack: 1 });
});

test("the store is read once however many times the hooks ask", async () => {
  const { mod, storage } = await load(JSON.stringify({ [MOD]: { rule: "two-ages" } }));
  for (let i = 0; i < 1000; i++) mod.getSettings();
  assert.equal(storage.reads, 1);
  assert.equal(mod.getSettings().agesBack, 2);
});

test("stored values are honoured", async () => {
  const { mod } = await load(JSON.stringify({ [MOD]: { enabled: false, rule: "two-ages" } }));
  assert.deepEqual({ ...mod.getSettings() }, { enabled: false, rule: "two-ages", agesBack: 2 });
});

test("an unknown rule or a missing switch reads as the default", async () => {
  const { mod } = await load(JSON.stringify({ [MOD]: { rule: "lenient" } }));
  assert.equal(mod.getSettings().rule, "earlier");
  assert.equal(mod.getSettings().enabled, true);
});

test("setRule writes through, keeps the other mods' sections, applies at once and says so", async () => {
  const other = { "tower-canals": { mode: "one-tile" } };
  const { mod, storage } = await load(JSON.stringify(other));
  mod.getSettings();
  mod.setRule("two-ages");
  assert.deepEqual(stored(storage), { ...other, [MOD]: { rule: "two-ages" } });
  assert.equal(mod.getSettings().agesBack, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, mod.SETTINGS_CHANGED_EVENT);
  assert.equal(events[0].detail.key, "rule");
});

test("setEnabled keeps the rule already stored beside it", async () => {
  const { mod, storage } = await load(JSON.stringify({ [MOD]: { rule: "two-ages" } }));
  mod.setEnabled(false);
  assert.deepEqual(stored(storage)[MOD], { rule: "two-ages", enabled: false });
  assert.equal(mod.getSettings().enabled, false);
  assert.equal(mod.getSettings().rule, "two-ages");
});

test("setRule ignores an id it doesn't know", async () => {
  const { mod, storage } = await load(null);
  mod.setRule("lenient");
  assert.equal(storage.writes, 0);
  assert.equal(events.length, 0);
  assert.equal(mod.getSettings().rule, "earlier");
});

test("a store that isn't a settings root is left alone, and the choice still holds for the session", async () => {
  const foreign = JSON.stringify({ someKey: 5 });
  const { mod, storage } = await load(foreign);
  quietly(() => mod.setEnabled(false));
  assert.equal(storage.writes, 0);
  assert.equal(storage.row, foreign);
  assert.equal(mod.getSettings().enabled, false);
});

test("refreshSettings picks up a write made somewhere else", async () => {
  const { mod, storage } = await load(null);
  assert.equal(mod.getSettings().enabled, true);
  storage.row = JSON.stringify({ [MOD]: { enabled: false } });
  assert.equal(mod.getSettings().enabled, true, "the cache holds until told");
  assert.equal(mod.refreshSettings().enabled, false);
  assert.equal(mod.getSettings().enabled, false);
});

test("a store that throws reads as the defaults instead of throwing", async () => {
  const { mod, storage } = await load(null);
  storage.throws = true;
  assert.equal(mod.getSettings().enabled, true);
  assert.doesNotThrow(() => quietly(() => mod.setRule("two-ages")));
  assert.equal(mod.getSettings().rule, "two-ages");
});

test("RULES lists the dropdown's choices in order", async () => {
  const { mod } = await load(null);
  assert.deepEqual(mod.RULES.map((r) => r.id), ["earlier", "two-ages"]);
  assert.deepEqual(mod.RULES.map((r) => r.agesBack), [1, 2]);
});

// run

let failed = 0;
for (const [name, fn] of cases) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    console.error("FAIL  " + name + "\n      " + (e && e.message));
  }
}
console.log(`${passed}/${cases.length} settings tests passed`);
if (failed) process.exit(1);
