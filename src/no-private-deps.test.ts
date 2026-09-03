/**
 * Proves this package depends on nothing private. A public plugin author (and a
 * public CI) must be able to build it with only what is declared here — so no
 * source file may import a monorepo alias (`@/…`), reach outside the package
 * root with `../`, or name OpenFullDive's private core. Enforced by a scan, not
 * by trust.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = dirname(fileURLToPath(import.meta.url));

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return /\.ts$/.test(entry) ? [path] : [];
  });
}

function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return Array.from(source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g), (m) => m[1]!);
}

describe("no private dependency", () => {
  it("imports no monorepo alias and names no private core module", () => {
    // A monorepo alias or an OpenFullDive package other than this one.
    const forbidden = [/^@\//, /openfulldive\/(?!plugin-api)/i];
    const violations = tsFiles(srcRoot).flatMap((file) =>
      importSpecifiers(file)
        .filter((spec) => forbidden.some((re) => re.test(spec)))
        .map((spec) => `${relative(srcRoot, file)} -> ${spec}`),
    );
    expect(violations, `private dependency:\n${violations.join("\n")}`).toEqual([]);
  });

  it("no relative import escapes the package's own src root", () => {
    const violations = tsFiles(srcRoot).flatMap((file) =>
      importSpecifiers(file)
        .filter((spec) => spec.startsWith("."))
        .filter((spec) => {
          const target = resolve(dirname(file), spec);
          return relative(srcRoot, target).startsWith("..");
        })
        .map((spec) => `${relative(srcRoot, file)} -> ${spec}`),
    );
    expect(violations, `relative import escaping the package:\n${violations.join("\n")}`).toEqual([]);
  });

  it("uses only node: builtins inside *.test.ts files, never in shipped source", () => {
    const shipped = tsFiles(srcRoot).filter((f) => !/\.test\.ts$/.test(f) && !/__fixtures__/.test(f));
    const violations = shipped.flatMap((file) =>
      importSpecifiers(file)
        .filter((spec) => /^node:/.test(spec))
        .map((spec) => `${relative(srcRoot, file)} -> ${spec}`),
    );
    expect(violations, `shipped source importing a node builtin:\n${violations.join("\n")}`).toEqual([]);
  });
});
