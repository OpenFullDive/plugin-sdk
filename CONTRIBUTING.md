# Contributing to @openfulldive/plugin-api

Thanks for your interest. This package is the shared contract between
OpenFullDive and the plugins built against it, so changes here ripple to every
plugin — it moves deliberately.

## Ground rules

- **The contract is small on purpose.** New capabilities, manifest fields, or
  validation rules are added only when a real plugin needs them, not
  speculatively. An issue describing the concrete need comes before a PR.
- **No dependency on anything private.** This package must build and test with
  only what it declares. A test (`no-private-deps.test.ts`) enforces that no
  source imports a private path; do not work around it.
- **Backward compatibility during `0.x` is best-effort, not guaranteed.** If a
  change breaks the contract, say so plainly in the PR; the API compatibility
  version (`PLUGIN_API_VERSION`) is how the host detects incompatibility.

## Developing

```sh
npm install
npm run typecheck
npm test
npm run build
```

- Source is `src/`; the published output is `dist/` (built with `tsc`).
- Add or update tests for any behavior change; validation rules especially must
  have both an accepting and a rejecting case.

## Submitting

- Open a PR with a clear description of the need and the change.
- Keep the diff focused; unrelated cleanups belong in their own PR.
- By contributing you agree your contribution is licensed under Apache-2.0,
  the license of this project.

## Security

Please do not open a public issue for a security concern — see
[SECURITY.md](./SECURITY.md).
