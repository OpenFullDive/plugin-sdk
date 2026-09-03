/**
 * Manifest and install-time validation. Pure — no database, framework, or
 * server imports, so a plugin author can run these while developing and a host
 * can run them at install time against the identical rules.
 *
 * A rejection is a thrown `PluginValidationError` with a machine-readable
 * `reason`, so a build- or startup-time check can fail loudly rather than
 * loading a bad plugin silently.
 */
import {
  HOST_CAPABILITIES,
  type HostCapabilityId,
  type InstallOptions,
  NAV_ICON_TOKENS,
  PLUGIN_ID_PATTERN,
  type PluginManifest,
  RESERVED_PLUGIN_IDS,
  SEARCH_CATEGORY_ID_PATTERN,
  SUPPORTED_PLUGIN_API,
  type SupportedPluginApi,
} from "./types.js";

export type PluginValidationReason =
  | "bad_id"
  | "reserved_id"
  | "unsupported_api"
  | "unknown_capability"
  | "grant_not_subset"
  | "duplicate_contribution"
  | "bad_navigation"
  | "bad_route"
  | "bad_search_category";

export class PluginValidationError extends Error {
  readonly reason: PluginValidationReason;
  readonly pluginId: string;
  constructor(pluginId: string, reason: PluginValidationReason, detail: string) {
    super(`Plugin "${pluginId}" rejected (${reason}): ${detail}`);
    this.name = "PluginValidationError";
    this.reason = reason;
    this.pluginId = pluginId;
  }
}

const HOST_CAPABILITY_SET: ReadonlySet<string> = new Set(HOST_CAPABILITIES);
const RESERVED_SET: ReadonlySet<string> = new Set(RESERVED_PLUGIN_IDS);
const NAV_ICON_SET: ReadonlySet<string> = new Set(NAV_ICON_TOKENS);

/** Whether an `apiVersion` string is one this package's rules cover. */
export function isSupportedApi(apiVersion: string): apiVersion is SupportedPluginApi {
  return (SUPPORTED_PLUGIN_API as readonly string[]).includes(apiVersion);
}

/**
 * Options a host may layer onto manifest validation.
 *
 * A plugin's search category may not claim an id the host already uses for one
 * of its own categories. Only the host knows that list, so it passes it here;
 * a plugin author validating during development can omit it, and only the
 * shape/uniqueness of their own categories is checked.
 */
export type ValidateManifestOptions = {
  reservedSearchCategoryIds?: Iterable<string>;
};

/**
 * Validate a manifest on its own — shape, id, API compatibility, and internal
 * uniqueness of contributions. Does not consider grants (that needs the install
 * options; `validateInstall` layers those on top).
 */
export function validateManifest(manifest: PluginManifest, options: ValidateManifestOptions = {}): void {
  const id = manifest.id;
  const reservedCategories: ReadonlySet<string> =
    options.reservedSearchCategoryIds instanceof Set
      ? options.reservedSearchCategoryIds
      : new Set(options.reservedSearchCategoryIds ?? []);

  if (!PLUGIN_ID_PATTERN.test(id)) {
    throw new PluginValidationError(id, "bad_id", "id must match ^[a-z][a-z0-9-]{1,62}$");
  }
  if (RESERVED_SET.has(id)) {
    throw new PluginValidationError(id, "reserved_id", "this id is reserved for a host surface");
  }
  if (!isSupportedApi(manifest.apiVersion)) {
    throw new PluginValidationError(
      id,
      "unsupported_api",
      `apiVersion ${manifest.apiVersion} is not in [${SUPPORTED_PLUGIN_API.join(", ")}]`,
    );
  }

  for (const cap of manifest.requires ?? []) {
    if (!HOST_CAPABILITY_SET.has(cap)) {
      throw new PluginValidationError(id, "unknown_capability", `requires unknown capability "${cap}"`);
    }
  }

  // Navigation: namespaced ids, known icon token, absolute href, unique within the manifest.
  const navIds = new Set<string>();
  for (const nav of manifest.navigation ?? []) {
    if (!nav.id.startsWith(`${id}.`)) {
      throw new PluginValidationError(id, "bad_navigation", `navigation id "${nav.id}" must be namespaced by the plugin id`);
    }
    if (!nav.href.startsWith("/")) {
      throw new PluginValidationError(id, "bad_navigation", `navigation href "${nav.href}" must be an absolute path`);
    }
    if (!NAV_ICON_SET.has(nav.icon)) {
      throw new PluginValidationError(id, "bad_navigation", `navigation icon "${nav.icon}" is not a host icon token`);
    }
    if (navIds.has(nav.id)) {
      throw new PluginValidationError(id, "duplicate_contribution", `duplicate navigation id "${nav.id}"`);
    }
    navIds.add(nav.id);
  }

  // Routes: unique logical ids, absolute paths.
  const routeIds = new Set<string>();
  for (const route of manifest.routes ?? []) {
    if (!route.path.startsWith("/")) {
      throw new PluginValidationError(id, "bad_route", `route path "${route.path}" must be an absolute path`);
    }
    if (routeIds.has(route.id)) {
      throw new PluginValidationError(id, "duplicate_contribution", `duplicate route id "${route.id}"`);
    }
    routeIds.add(route.id);
  }

  // Search categories: bounded slug shape, not a host category id, unique within the manifest.
  const searchIds = new Set<string>();
  for (const category of manifest.search ?? []) {
    if (!SEARCH_CATEGORY_ID_PATTERN.test(category.id)) {
      throw new PluginValidationError(id, "bad_search_category", `search category id "${category.id}" must match ^[a-z][a-z0-9-]{0,31}$`);
    }
    if (reservedCategories.has(category.id)) {
      throw new PluginValidationError(id, "bad_search_category", `search category id "${category.id}" is reserved by the host`);
    }
    if (searchIds.has(category.id)) {
      throw new PluginValidationError(id, "duplicate_contribution", `duplicate search category id "${category.id}"`);
    }
    searchIds.add(category.id);
  }
}

/**
 * Validate a manifest together with the capabilities the host is granting it.
 * The load-bearing rule: **required must be a subset of granted** — a plugin
 * cannot grant itself anything, and cannot act on a capability it was not given.
 */
export function validateInstall(manifest: PluginManifest, options: InstallOptions, manifestOptions: ValidateManifestOptions = {}): void {
  validateManifest(manifest, manifestOptions);

  const granted: ReadonlySet<string> = new Set(options.grants);
  for (const cap of options.grants) {
    if (!HOST_CAPABILITY_SET.has(cap)) {
      throw new PluginValidationError(manifest.id, "unknown_capability", `granted unknown capability "${cap}"`);
    }
  }
  for (const req of manifest.requires ?? []) {
    if (!granted.has(req)) {
      throw new PluginValidationError(manifest.id, "grant_not_subset", `requires "${req}" but it was not granted`);
    }
  }
}

/** Whether a granted capability set holds a capability. Central so nothing guesses. */
export function pluginHasCapability(grants: readonly HostCapabilityId[], capability: HostCapabilityId): boolean {
  return grants.includes(capability);
}
