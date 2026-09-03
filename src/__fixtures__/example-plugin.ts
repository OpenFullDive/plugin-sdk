/**
 * A consumer fixture — a plugin author's manifest, typed through this package's
 * own public entry point. It type-checking is itself part of the test: it
 * proves the exported types are usable to declare a real manifest, and that a
 * consumer imports only from the package root, never a deep or private path.
 */
import type { PluginManifest } from "../index.js";

export const examplePluginManifest: PluginManifest = {
  id: "example-plugin",
  name: "Example Plugin",
  version: "0.1.0",
  apiVersion: "0.1",
  description: "A minimal plugin used to exercise the contract.",
  navigation: [
    { id: "example-plugin.navigation.main", label: "Example", href: "/example-plugin", icon: "compass", order: 100 },
  ],
  routes: [{ id: "index", path: "/example-plugin" }],
  requires: ["navigation.contribute", "search.contribute", "user.storage"],
  storage: { namespace: "example-plugin.storage", keys: ["state:v1"] },
  search: [{ id: "example", label: "Example", order: 50 }],
};
