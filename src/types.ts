/**
 * The OpenFullDive plugin contract — the serializable metadata a plugin
 * declares, plus the capability vocabulary and the bounded token sets a
 * manifest may reference.
 *
 * Everything here is pure and serializable: no database, Node, framework, or
 * server-service imports, so a plugin's manifest module can be pulled into a
 * client bundle without dragging server code with it. A plugin's search
 * providers and server loaders live in a separate server surface, never here.
 *
 * **A capability is not user authority.** A capability names which host API a
 * plugin's *code* may call. It grants a plugin's users no permission of their
 * own: every action taken on behalf of a person is still authorized by the
 * host, against the host's own authorization rules. A plugin never becomes a
 * second authorization system.
 */

/**
 * The plugin API compatibility version this package expresses, independent of
 * the package's own semantic version. A host declares which API versions it
 * supports and rejects a manifest whose `apiVersion` is not among them. During
 * the `0.x` series this may change between minor releases.
 */
export const PLUGIN_API_VERSION = "0.1";

/** API versions a manifest may currently declare. */
export const SUPPORTED_PLUGIN_API = ["0.1"] as const;
export type SupportedPluginApi = (typeof SUPPORTED_PLUGIN_API)[number];

/**
 * The capabilities a plugin may be granted. A plugin *requests* a subset via
 * `requires`; the host *grants* a subset separately — a plugin can never grant
 * itself anything, and `requires` must be a subset of what the host grants.
 * Deliberately narrow: no raw database, session, email, private messages,
 * administrative execution, moderation, secrets, filesystem, environment, or
 * arbitrary network access is expressible here.
 */
export const HOST_CAPABILITIES = [
  "navigation.contribute",
  "search.contribute",
  "public.evidence.read",
  "public.capability.read",
  "public.organization.read",
  "user.storage",
] as const;
export type HostCapabilityId = (typeof HOST_CAPABILITIES)[number];

/**
 * Plugin ids a community plugin can never claim — names reserved for host
 * surfaces and the trust boundary. Checked against the lowercased id.
 */
export const RESERVED_PLUGIN_IDS = [
  "auth",
  "admin",
  "moderation",
  "evidence",
  "identity",
  "users",
  "sessions",
  "core",
  "openfulldive",
] as const;

/** The plugin id shape: lowercase, starts with a letter, 2–63 characters total. */
export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

/**
 * A bounded, host-owned set of icon tokens a navigation contribution may
 * reference. A contribution names a token, never a component — serializable
 * metadata must not carry markup. The host maps a token to an icon at render
 * time.
 */
export const NAV_ICON_TOKENS = ["map", "search", "layers", "chart", "compass", "radar", "telescope"] as const;
export type NavIconToken = (typeof NAV_ICON_TOKENS)[number];

export type PluginNavigationContribution = {
  /** Namespaced by the plugin id, e.g. `myplugin.navigation.main`; unique across plugins. */
  id: string;
  label: string;
  /** A first-class product URL the plugin owns, e.g. `/myplugin`. */
  href: string;
  icon: NavIconToken;
  /** Lower sorts earlier; contributions without one sort after those with one. */
  order?: number;
};

export type PluginRouteDescriptor = {
  /** A logical route key the host resolves when rendering the plugin's route. */
  id: string;
  /** The owned path, e.g. `/myplugin` or `/myplugin/[slug]`. */
  path: string;
};

/** Declares the storage keys a plugin persists per user. */
export type PluginStorageDeclaration = {
  /** Namespaced, e.g. `myplugin.storage`. */
  namespace: string;
  keys: string[];
};

/**
 * A bare slug for a plugin's search category — not namespaced, because it is
 * what a person types to filter search results, so it reads like `myplugin`,
 * not `myplugin.search.myplugin`.
 */
export const SEARCH_CATEGORY_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * A search category a plugin contributes. Metadata only — the function that
 * actually runs the search is server-only and registered separately. This is
 * what the host renders as a filter tab. Rejected at install if it collides
 * with a host category id or another plugin's.
 */
export type PluginSearchCategoryContribution = {
  /** A bare slug — collision-checked against host category ids and every other plugin. */
  id: string;
  label: string;
  /** Lower sorts earlier, after every host category. Omit to sort by install order. */
  order?: number;
};

/** Everything a plugin declares about itself. Serializable, safe metadata. */
export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description?: string;
  navigation?: PluginNavigationContribution[];
  routes?: PluginRouteDescriptor[];
  requires?: HostCapabilityId[];
  storage?: PluginStorageDeclaration;
  search?: PluginSearchCategoryContribution[];
};

/**
 * Trust is host-owned, never self-declared. A manifest field claiming official
 * status means nothing; the host decides at install time.
 */
export type PluginTrust = "official" | "reviewed-community";

export type InstallOptions = {
  trust: PluginTrust;
  enabled: boolean;
  /** The capabilities the host actually grants. `requires` must be a subset of this. */
  grants: HostCapabilityId[];
};

export type InstalledPlugin = {
  manifest: PluginManifest;
  trust: PluginTrust;
  enabled: boolean;
  grants: readonly HostCapabilityId[];
};

/** A resolved navigation item the host can render, produced from an enabled plugin. */
export type ResolvedNavItem = {
  pluginId: string;
  id: string;
  label: string;
  href: string;
  icon: NavIconToken;
  order: number;
};

/**
 * A search category descriptor the host can render as a tab —
 * `{ id, label, source, order }`. `source: "plugin"` marks one contributed by
 * an enabled plugin, as opposed to a host category.
 */
export type ResolvedSearchCategory = {
  pluginId: string;
  id: string;
  label: string;
  source: "plugin";
  order: number;
};

// ---------------------------------------------------------------------------
// Public-read plugin capability contracts — Phase 8 of extension-platform-v0
// ---------------------------------------------------------------------------

/**
 * Public evidence DTO — the shape a plugin receives when reading evidence.
 * Deliberately excludes editorial content (claim, limitation, relevance),
 * source details (sourceUrl, sourceTier), and internal state (editorId, published)
 * so a future private field cannot silently enter the plugin contract.
 */
export type PublicEvidenceDto = {
  id: string;
  slug: string;
  title: string;
  observedAt: string;
  publicationDate: string | null;
  capabilityIds: string[];
  organizationId: string | null;
  sourceType: string | null;
  labels: string[];
};

/** Public capability DTO — minimal metadata for analytics. */
export type PublicCapabilityDto = {
  id: string;
  slug: string;
  n: number;
  name: string;
};

/** Public organization DTO — minimal metadata for analytics. */
export type PublicOrganizationDto = {
  id: string;
  slug: string;
  name: string;
};

// ---------------------------------------------------------------------------
// Public-read query and response types
// ---------------------------------------------------------------------------

export type PublicEvidenceQuery = {
  /** Max 500, default 200. */
  limit?: number;
  /** Max 10000, default 0. */
  offset?: number;
  /** Filter to evidence linked to this capability. */
  capabilityId?: string;
  /** Filter to evidence linked to this organization. */
  organizationId?: string;
  /** ISO date (YYYY-MM-DD). Only evidence observed on or after this date. */
  observedAfter?: string;
  /** ISO date (YYYY-MM-DD). Only evidence observed on or before this date. */
  observedBefore?: string;
};

export type PublicEvidencePage = {
  items: PublicEvidenceDto[];
  total: number;
};

export type PublicOrganizationQuery = {
  /** Max 200, default 100. */
  limit?: number;
  /** Max 10000, default 0. */
  offset?: number;
};

// ---------------------------------------------------------------------------
// Public-read capability interfaces
// ---------------------------------------------------------------------------

/**
 * Read access to published evidence records. Gated by
 * `public.evidence.read`. The host implementation filters to published-only
 * and projects only DTO fields — a plugin never sees drafts, reviewer notes,
 * or raw source URLs.
 */
export type PublicEvidenceCapability = {
  list(query: PublicEvidenceQuery): Promise<PublicEvidencePage>;
};

/**
 * Read access to capability definitions. Gated by
 * `public.capability.read`.
 */
export type PublicCapabilityCapability = {
  list(): Promise<PublicCapabilityDto[]>;
  getBySlug(slug: string): Promise<PublicCapabilityDto | null>;
};

/**
 * Read access to organization profiles. Gated by
 * `public.organization.read`.
 */
export type PublicOrganizationCapability = {
  list(query?: PublicOrganizationQuery): Promise<PublicOrganizationDto[]>;
};

// ---------------------------------------------------------------------------
// Plugin server context — constructed by core for server-side plugin code
// ---------------------------------------------------------------------------

/**
 * Server-only context injected by core into a plugin's server loader.
 * Each capability field is present only when the corresponding grant was made
 * at install time. A plugin that requires all three will fail installation
 * if any is missing (`requires ⊆ grants`).
 *
 * This type is defined in the SDK so plugins can type their server loaders
 * against it, but the *implementation* lives in core (`src/lib/plugin-server-context.ts`).
 */
export type PluginServerContext = {
  evidence?: PublicEvidenceCapability;
  capabilities?: PublicCapabilityCapability;
  organizations?: PublicOrganizationCapability;
};
