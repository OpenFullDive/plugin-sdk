# @openfulldive/plugin-api

The plugin contract for OpenFullDive's build-time extension platform: the
manifest types a plugin declares, the capability vocabulary it may request, and
the validation helpers that check a manifest against the same rules the host
enforces at install time.

This package depends on nothing from OpenFullDive's private core. A plugin
depends on it — and nothing else of OpenFullDive's — to build.

> **Status: `0.x` alpha.** The API compatibility version is `0.1`. During the
> `0.x` series the contract may change between minor releases; pin an exact
> version.

## Install

```sh
npm install @openfulldive/plugin-api
```

## What a plugin is

A plugin is a separately-maintained package that the host installs at build
time, exactly version-pinned. It contributes **serializable metadata** — a
manifest — and, separately, server-side code (search providers, loaders). There
is no runtime install path and no sandbox: build-time review and exact pinning
are the controls.

**A capability is not user authority.** A capability names which host API a
plugin's *code* may call. It grants a plugin's users no permission of their own;
every action on behalf of a person is authorized by the host, against the
host's own rules.

> **Building a plugin end to end?** This README is the contract reference. For
> the full walkthrough — package layout, the UI storage bridge, the search
> provider, and how a host mounts your route — see
> [docs/authoring-a-plugin.md](./docs/authoring-a-plugin.md), with
> `@openfulldive/plugin-roadmap` as the worked example.

## Declaring a manifest

```ts
import type { PluginManifest } from "@openfulldive/plugin-api";

export const manifest: PluginManifest = {
  id: "my-plugin",              // ^[a-z][a-z0-9-]{1,62}$, not a reserved id
  name: "My Plugin",
  version: "0.1.0",
  apiVersion: "0.1",            // must be a supported plugin API version
  navigation: [
    { id: "my-plugin.navigation.main", label: "My Plugin", href: "/my-plugin", icon: "map" },
  ],
  routes: [{ id: "index", path: "/my-plugin" }],
  requires: ["navigation.contribute"],
  search: [{ id: "my-plugin", label: "My Plugin" }],
};
```

- **Navigation** ids are namespaced by your plugin id; icons are one of a bounded
  host-owned token set (`NAV_ICON_TOKENS`), never a component.
- **Search** category ids are bare slugs (what a person types to filter results)
  and may not collide with a host category.
- **`requires`** lists the capabilities you need. The host grants capabilities
  separately, and a manifest cannot install unless `requires` is a subset of
  what the host grants — a plugin can never grant itself anything.

## Validating a manifest

```ts
import { validateManifest, validateInstall, PluginValidationError } from "@openfulldive/plugin-api";

validateManifest(manifest);                 // shape, ids, api version, uniqueness
// with the host's grants, checks requires ⊆ grants:
validateInstall(manifest, { trust: "reviewed-community", enabled: true, grants: ["navigation.contribute"] });
```

A rejection throws a `PluginValidationError` with a machine-readable `reason`,
so a build- or startup-time check fails loudly rather than loading a bad plugin
silently.

## Capabilities

`navigation.contribute`, `search.contribute`, `public.evidence.read`,
`public.capability.read`, `public.organization.read`, `user.storage`.

Deliberately narrow: no raw database, session, email, private messages,
administrative execution, moderation, secrets, filesystem, environment, or
arbitrary network access is expressible.

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) — the OpenFullDive
name and marks are reserved (Apache §6) and not granted by this license.
