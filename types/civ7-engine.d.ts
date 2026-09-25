// Ambient declarations for the Civ7 GameFace engine globals the mod reads without importing. The
// engine boundary is untyped, so each is `any`; the JSDoc + defensive guards in the code are the
// real contract. checkJs needs these declared so `Game`, `GameInfo`, etc. resolve under strict mode.

declare const Game: any;
declare const GameContext: any;
declare const Locale: any;
declare const MapConstructibles: any;
declare const Constructibles: any;
declare const Districts: any;
declare const GameplayMap: any;
declare const GameInfo: any;
declare const Cities: any;
declare const CityOperationTypes: any;

// The engine event bus (engine.on / engine.off / engine.whenReady).
declare const engine: any;
declare const Players: any;
