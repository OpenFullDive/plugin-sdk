import { describe, expect, it } from "vitest";
import {
  HOST_CAPABILITIES,
  PLUGIN_API_VERSION,
  RESERVED_PLUGIN_IDS,
  SUPPORTED_PLUGIN_API,
  isSupportedApi,
  pluginHasCapability,
  PluginValidationError,
  validateInstall,
  validateManifest,
  type InstallOptions,
  type PluginManifest,
} from "./index.js";
import { examplePluginManifest } from "./__fixtures__/example-plugin.js";

function manifest(over: Partial<PluginManifest> = {}): PluginManifest {
  return { id: "sample-plugin", name: "Sample", version: "0.1.0", apiVersion: "0.1", ...over };
}

describe("API version", () => {
  it("exposes a compatibility version and a supported set that includes it", () => {
    expect(PLUGIN_API_VERSION).toBe("0.1");
    expect(isSupportedApi(PLUGIN_API_VERSION)).toBe(true);
    expect(SUPPORTED_PLUGIN_API).toContain("0.1");
  });

  it("parses and rejects unsupported versions", () => {
    expect(isSupportedApi("0.1")).toBe(true);
    expect(isSupportedApi("0.2")).toBe(false);
    expect(isSupportedApi("1.0")).toBe(false);
    expect(isSupportedApi("nonsense")).toBe(false);
  });
});

describe("manifest id rules", () => {
  it("accepts a valid id", () => {
    expect(() => validateManifest(manifest({ id: "my-plugin" }))).not.toThrow();
  });

  it("rejects ids that break the pattern", () => {
    for (const id of ["MyPlugin", "1plugin", "a", "-plugin", "plugin_underscore"]) {
      expect(() => validateManifest(manifest({ id })), id).toThrow(PluginValidationError);
    }
  });

  it("rejects every reserved id", () => {
    for (const id of RESERVED_PLUGIN_IDS) {
      expect(() => validateManifest(manifest({ id })), id).toThrow(/reserved_id/);
    }
  });
});

describe("API compatibility rejection", () => {
  it("rejects a manifest whose apiVersion is unsupported", () => {
    expect(() => validateManifest(manifest({ apiVersion: "0.2" }))).toThrow(/unsupported_api/);
  });
});

describe("capability declarations", () => {
  it("rejects a required capability outside the known set", () => {
    const bad = manifest({ requires: ["evidence.publish" as never] });
    expect(() => validateManifest(bad)).toThrow(/unknown_capability/);
  });

  it("accepts every real host capability as a requirement", () => {
    expect(() => validateManifest(manifest({ requires: [...HOST_CAPABILITIES] }))).not.toThrow();
  });
});

describe("navigation and route contributions", () => {
  it("requires a navigation id namespaced by the plugin id", () => {
    const bad = manifest({ navigation: [{ id: "other.navigation.main", label: "X", href: "/x", icon: "map" }] });
    expect(() => validateManifest(bad)).toThrow(/bad_navigation/);
  });

  it("requires an absolute navigation href and a known icon token", () => {
    expect(() =>
      validateManifest(manifest({ navigation: [{ id: "sample-plugin.n", label: "X", href: "https://x", icon: "map" }] })),
    ).toThrow(/bad_navigation/);
    expect(() =>
      validateManifest(manifest({ navigation: [{ id: "sample-plugin.n", label: "X", href: "/x", icon: "not-a-token" as never }] })),
    ).toThrow(/bad_navigation/);
  });

  it("rejects a route path that is not absolute, and duplicate route ids", () => {
    expect(() => validateManifest(manifest({ routes: [{ id: "index", path: "relative" }] }))).toThrow(/bad_route/);
    expect(() =>
      validateManifest(manifest({ routes: [{ id: "index", path: "/a" }, { id: "index", path: "/b" }] })),
    ).toThrow(/duplicate_contribution/);
  });
});

describe("storage declaration", () => {
  it("accepts a namespaced storage declaration with keys", () => {
    expect(() =>
      validateManifest(manifest({ storage: { namespace: "sample-plugin.storage", keys: ["state:v1"] } })),
    ).not.toThrow();
  });
});

describe("search category contract", () => {
  it("accepts a bare, well-formed slug", () => {
    expect(() => validateManifest(manifest({ search: [{ id: "example", label: "Example" }] }))).not.toThrow();
  });

  it("rejects a malformed category id", () => {
    expect(() => validateManifest(manifest({ search: [{ id: "Example Search", label: "X" }] }))).toThrow(/bad_search_category/);
  });

  it("rejects a category id the host reserves, when the host supplies its list", () => {
    expect(() =>
      validateManifest(manifest({ search: [{ id: "posts", label: "Posts" }] }), { reservedSearchCategoryIds: ["posts", "users"] }),
    ).toThrow(/bad_search_category/);
  });

  it("does not reserve anything when the host supplies no list — a plugin author validates only their own shape", () => {
    expect(() => validateManifest(manifest({ search: [{ id: "posts", label: "Posts" }] }))).not.toThrow();
  });

  it("rejects duplicate category ids within one manifest", () => {
    expect(() =>
      validateManifest(manifest({ search: [{ id: "a", label: "A" }, { id: "a", label: "B" }] })),
    ).toThrow(/duplicate_contribution/);
  });
});

describe("validateInstall — a plugin cannot grant itself anything", () => {
  const grantAll: InstallOptions = { trust: "reviewed-community", enabled: true, grants: [...HOST_CAPABILITIES] };

  it("accepts when required is a subset of granted", () => {
    const m = manifest({ requires: ["navigation.contribute"] });
    expect(() => validateInstall(m, { ...grantAll, grants: ["navigation.contribute"] })).not.toThrow();
  });

  it("rejects when a required capability was not granted", () => {
    const m = manifest({ requires: ["user.storage"] });
    expect(() => validateInstall(m, { ...grantAll, grants: ["navigation.contribute"] })).toThrow(/grant_not_subset/);
  });

  it("rejects granting an unknown capability", () => {
    expect(() => validateInstall(manifest(), { ...grantAll, grants: ["mystery" as never] })).toThrow(/unknown_capability/);
  });
});

describe("pluginHasCapability", () => {
  it("reports membership in a granted set", () => {
    expect(pluginHasCapability(["user.storage"], "user.storage")).toBe(true);
    expect(pluginHasCapability(["navigation.contribute"], "user.storage")).toBe(false);
  });
});

describe("the consumer fixture", () => {
  it("is a valid manifest through the package's own public types and validators", () => {
    expect(() => validateInstall(examplePluginManifest, {
      trust: "official",
      enabled: true,
      grants: ["navigation.contribute", "search.contribute", "user.storage"],
    })).not.toThrow();
  });
});
