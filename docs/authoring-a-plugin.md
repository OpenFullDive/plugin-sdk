# Authoring a plugin

A step-by-step guide to building an OpenFullDive plugin end to end. The
[README](../README.md) is the contract reference (manifest types, capabilities,
validation); this is the tutorial that puts them together into a working package.

The reference implementation is **`@openfulldive/plugin-roadmap`** — the Roadmap
plugin, public and installable. Everything here mirrors how it is built.

> **Status: `0.x` alpha.** The API compatibility version is `0.1`. During `0.x`
> the contract may change between minor releases — pin an exact version, and
> prefer fixing a bad abstraction over preserving it.

---

## What you are building

A plugin is a **separately-maintained npm package** that a host installs at
**build time**, exactly version-pinned. There is no runtime install path and no
sandbox — build-time source review and exact pinning are the controls. Your
package contributes:

- a **manifest** — serializable metadata declaring your id, navigation, routes,
  search categories, storage, and the capabilities you require;
- a **UI component** the host renders at a route it owns;
- optionally, **server-only code** (a search provider).

The host owns every surface. Your plugin fills host-controlled slots. You never
import anything from the host's private core; you depend on
`@openfulldive/plugin-api` and nothing else of OpenFullDive's.

---

## Package layout

Ship three entry points via your `package.json` `exports` map — the client
manifest, the UI, and the server-only code kept strictly separate:

```jsonc
{
  "name": "@openfulldive/plugin-example",
  "type": "module",
  "exports": {
    ".":        "./src/index.ts",              // manifest + serializable content
    "./ui":     "./src/ui/ExampleExplorer.tsx", // the React component the host mounts
    "./server": "./src/search.ts"               // server-only: your search provider
  }
}
```

Why the split: the `.` and `/ui` entries are reachable from the host's client
bundle, so they must contain **only serializable data and client-safe React**.
The `/server` entry holds anything server-only (a search provider, a loader) and
must never be importable from a client component. Keeping them on separate
subpaths is what lets the host enforce that boundary.

If you ship TypeScript source (rather than compiled output), the host adds your
package to its bundler's transpile list; publishing compiled `dist/` like the
SDK does also works.

---

## Step 1 — Declare the manifest (`.` subpath)

```ts
import type { PluginManifest } from "@openfulldive/plugin-api";

export const exampleManifest: PluginManifest = {
  id: "example",                     // ^[a-z][a-z0-9-]{1,62}$, not a reserved id
  name: "Example",
  version: "0.1.0",
  apiVersion: "0.1",                 // a supported plugin API version
  navigation: [
    { id: "example.navigation.main", label: "Example", href: "/example", icon: "map", order: 20 },
  ],
  routes: [
    { id: "index", path: "/example" },
    { id: "detail", path: "/example/[slug]" },
  ],
  requires: ["navigation.contribute", "search.contribute", "user.storage"],
  storage: { namespace: "example.storage", keys: ["progress:v1", "favorites:v1"] },
  search: [{ id: "example", label: "Example", order: 80 }],
};
```

Rules the host enforces (see [README §Declaring a manifest](../README.md)):

- **Navigation** ids are namespaced by your plugin id; `href` is absolute;
  `icon` is one of the bounded host tokens (`NAV_ICON_TOKENS`) — a name, never a
  component.
- **Routes** are logical `{ id, path }` pairs with absolute paths. This is a
  **contract the host validates for collisions**, not a live router — a host
  maintainer hand-writes the adapter that mounts your route (see Step 4). Keep
  route ids stable; the adapter references them.
- **Search** category ids are bare slugs (what a person types to filter) and may
  not collide with a host category.
- **`storage`** declares a namespace and the exact keys you will persist. The
  host rejects writes to undeclared keys — version your keys (`progress:v1`).
- **`requires`** lists the capabilities your code needs. The host grants
  capabilities separately; your manifest cannot install unless
  `requires ⊆ grants`. **You can never grant yourself anything.**

Validate in your own tests exactly as the host will:

```ts
import { validateManifest, PluginValidationError } from "@openfulldive/plugin-api";
validateManifest(exampleManifest); // throws PluginValidationError with a machine-readable reason
```

---

## Step 2 — Understand capabilities (they are not user authority)

A capability names which **host API your code may call**. It grants your plugin's
*users* no permission of their own — every action on behalf of a person is
authorized by the host, against the host's own rules. Request the **narrowest**
set that your plugin needs:

| Capability | Lets your code… |
|---|---|
| `navigation.contribute` | add a sidebar entry |
| `search.contribute` | register a search provider |
| `user.storage` | persist per-user state through the host's bridge |
| `public.evidence.read` / `public.capability.read` / `public.organization.read` | read public host data |

The vocabulary is deliberately narrow: no raw database, session, email, private
messages, admin execution, moderation, secrets, filesystem, environment, or
arbitrary network access is expressible.

---

## Step 3 — Build the UI, accepting a storage bridge (`/ui` subpath)

Your component is a normal React component with one convention: for per-user
persistence it **accepts a storage bridge as props** and imports no server
action and no database. The host resolves the signed-in user and hands you
callables:

```tsx
export type ExampleStorage = {
  getState: () => Promise<Record<string, unknown> | null>;
  setState: (key: string, value: unknown) => Promise<{ ok: boolean; error?: string }>;
};

export type ExampleExplorerProps = {
  slug: string;
  isSignedIn?: boolean;
  storage?: ExampleStorage; // present + signed in ⇒ server state is authoritative
};

export default function ExampleExplorer({ slug, isSignedIn = false, storage }: ExampleExplorerProps) {
  const serverBacked = isSignedIn && !!storage;
  // serverBacked: read/write through storage.getState / storage.setState (keys you declared).
  // otherwise: fall back to localStorage on your own — the host simply hands you no bridge.
}
```

The host's storage service enforces namespace isolation (you cannot touch
another plugin's keys), per-user isolation, declared-key-only writes, and value
size limits. Signed out, `getState()` returns `null` and you use `localStorage`.

---

## Step 4 — How the host mounts your route (what to expect)

You do **not** claim a route in the host's URL space. A host maintainer writes a
thin adapter at your declared path that gates on your plugin being enabled,
resolves the actor, and renders your UI with the storage bridge:

```tsx
// host-side, illustrative — you provide the imported pieces
import ExampleExplorer from "@openfulldive/plugin-example/ui";

export default async function ExamplePage() {
  ensureCorePluginsInstalled();
  if (!resolvePluginRoute("example", "index")) notFound(); // disabled ⇒ honest 404
  const actor = await getActor();
  return (
    <ExampleExplorer
      slug={/* … */}
      isSignedIn={Boolean(actor)}
      storage={{ getState: /* host action */, setState: /* host action */ }}
    />
  );
}
```

What this means for you: keep your UI a **pure component of its props**
(`slug`, `isSignedIn`, `storage`). Do not reach for host globals, sessions, or
the database — everything you need arrives as a prop.

---

## Step 5 — Provide a search provider (`/server` subpath)

If you contribute search, export a server-only provider. It is a pure function
of the query and paging window, returning ranked results — no database, no
host imports:

```ts
// src/search.ts — the "/server" entry
export function searchExample(query: string, limit: number, offset: number): SearchResult[] {
  // rank your in-package content against `query`, honour limit/offset, return results.
}
```

The host registers this provider and **clamps and isolates** its output: if your
provider throws or returns an oversized payload, it cannot erase the host's own
search results. Keep it total and fast.

---

## Step 6 — Test it the way the host will

Cover, at minimum:

- `validateManifest(manifest)` passes, and deliberately-broken variants throw the
  expected `reason`;
- an **import-path check** proving your package imports nothing from a private
  host path — only `@openfulldive/plugin-api`;
- your search provider's ranking, paging, and unknown-query behaviour;
- your storage keys match what the manifest declares.

`@openfulldive/plugin-roadmap` is the worked reference for every one of these.

---

## Checklist

1. `npm install @openfulldive/plugin-api` (pin an exact version).
2. Declare and `validateManifest` your manifest.
3. Request the narrowest `requires`.
4. Build a UI that is a pure component of `{ slug, isSignedIn, storage }`.
5. Split any server-only code onto a `/server` subpath.
6. Test validation, the no-private-import boundary, search, and storage keys.
7. Publish exactly-version-pinned; the host reviews, pins, and mounts you.

---

License: your plugin is your own. This SDK is Apache-2.0; the OpenFullDive name
and marks are reserved (Apache §6) and not granted by the license — see
[NOTICE](../NOTICE).
