// bwab-options.js
//
// The mod's rows in Options > Add-ons (docs/OPTIONS.md): a checkbox that turns the offering of antiquated tiles on or
// off, and "Antiquated means", which picks how old a building has to be. Loaded in the main menu and in a game; a
// change is saved as it's made and applies the next time a Wonder's placement screen lists its sites. Cancel puts back
// what was there on opening.

import { CategoryType, OptionType, Options } from "/core/ui/options/model-options.js";
import { CategoryData } from "/core/ui/options/options-helpers.js";
import {
  RULES, getSettings, refreshSettings, setEnabled, setRule
} from "/tower-build-wonders-over-antiquated-buildings/ui/bwab-settings.js";

// Becomes the header key LOC_OPTIONS_GROUP_BWAB.
const GROUP = "bwab";

/** The "Antiquated means" row, kept so the checkbox can grey it out. @type {*} */
let ruleRow = null;

/** @param {boolean} off */
function greyRule(off) {
  if (!ruleRow) return;
  ruleRow.isDisabled = off;
  ruleRow.forceRender?.();
}

function addEnabledRow() {
  Options.addOption({
    category: CategoryType.Mods,
    group: GROUP,
    type: OptionType.Checkbox,
    id: "bwab-enabled",
    label: "LOC_BWAB_OPTION_ENABLED",
    description: "LOC_BWAB_OPTION_ENABLED_DESCRIPTION",
    initListener: (/** @type {*} */ info) => {
      info.currentValue = getSettings().enabled;
      info.valueOnOpen = info.currentValue;
    },
    updateListener: (/** @type {*} */ info, /** @type {*} */ value) => {
      info.currentValue = !!value;
      setEnabled(!!value);
      greyRule(!value);
    },
    restoreListener: (/** @type {*} */ info) => setEnabled(!!info.valueOnOpen)
  });
}

function addRuleRow() {
  ruleRow = {
    category: CategoryType.Mods,
    group: GROUP,
    type: OptionType.Dropdown,
    id: "bwab-rule",
    label: "LOC_BWAB_OPTION_RULE",
    description: "LOC_BWAB_OPTION_RULE_DESCRIPTION",
    dropdownItems: [{ label: "LOC_BWAB_OPTION_RULE_EARLIER" }, { label: "LOC_BWAB_OPTION_RULE_TWO_AGES" }],
    initListener: (/** @type {*} */ info) => {
      const s = getSettings();
      info.selectedItemIndex = Math.max(0, RULES.findIndex((r) => r.id === s.rule));
      info.valueOnOpen = info.selectedItemIndex;
      info.isDisabled = !s.enabled;
    },
    updateListener: (/** @type {*} */ info, /** @type {number} */ index) => {
      info.selectedItemIndex = index;
      setRule((RULES[index] || RULES[0]).id);
    },
    restoreListener: (/** @type {*} */ info) => setRule((RULES[info.valueOnOpen] || RULES[0]).id)
  };
  Options.addOption(ruleRow);
}

// The shared "Mods" category, created the same way Tower's other mods and the community's create it. This also runs
// in the main menu, where a throw would take the menu down, so any failure only leaves the rows out.
try {
  if (!CategoryType.Mods) CategoryType.Mods = "mods";
  if (!CategoryData[CategoryType.Mods]) {
    CategoryData[CategoryType.Mods] = {
      title: "LOC_UI_CONTENT_MGR_SUBTITLE",
      description: "LOC_UI_CONTENT_MGR_SUBTITLE_DESCRIPTION"
    };
  }
  Options.addInitCallback(() => {
    refreshSettings();
    addEnabledRow();
    addRuleRow();
  });
} catch (e) {
  console.error("[BWAB] Options rows not added: " + e);
}
