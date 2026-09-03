# Security Policy

## Scope

`@openfulldive/plugin-api` is a pure, dependency-light contract package: types
and validation helpers, no runtime I/O, no network, no filesystem, no execution
of plugin code. Its security surface is small by design. The controls that
actually protect a host are build-time source review and exact version pinning —
this package is **not** a sandbox, and nothing in it should be described as one.

## Reporting a vulnerability

Please report suspected vulnerabilities privately, not through a public issue or
pull request. Use GitHub's private vulnerability reporting for this repository
("Report a vulnerability" under the Security tab).

Include, where you can: the affected version, a description, and a minimal
reproduction. You can expect an acknowledgement, and we will coordinate a fix
and disclosure timeline with you.

## What is in scope

- A validation rule that accepts a manifest it should reject (for example, one
  that would let a plugin claim a reserved id or a capability it did not
  declare), or rejects one it should accept.
- A type or helper that misrepresents the contract in a way a host could rely on
  to its detriment.

## What is out of scope

- The behavior of any particular host or plugin built with this package.
- The absence of a sandbox — that is a deliberate design property, documented,
  not a vulnerability.
