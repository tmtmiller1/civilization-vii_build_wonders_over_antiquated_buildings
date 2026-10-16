// Stub for engine-served `/core/*` and `/base-standard/*` modules the mod imports by absolute path
// but which don't live in the mod folder. Routed here via tsconfig `paths`. Everything is `any`:
// this is the untyped engine boundary.
declare const _default: any;
export default _default;

// core/ui/options/model-options.js and options-helpers.js: the Options screen's model, for ui/bwab-options.js.
export const CategoryType: any;
export const OptionType: any;
export const Options: any;
export const CategoryData: any;
