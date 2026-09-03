/**
 * `@openfulldive/plugin-api` — the plugin contract for OpenFullDive's
 * build-time extension platform.
 *
 * Import the types to declare a manifest, and the validation helpers to check
 * it during development against the same rules the host enforces at install
 * time. Nothing here reaches OpenFullDive's private core; a plugin depends on
 * this package and nothing else of OpenFullDive's to build.
 */
export * from "./types.js";
export * from "./validation.js";
