// Repository Guard for the futarchy programs repo.
//
// Reads .github/repo-guard.toml as policy and runs the checks below.
// Companion workflow .github/workflows/repo-guard.yml posts a PR comment
// summarising the results.
//
// Checks:
//   1. Cargo manifests pin every external dep with `=x.y.z`.
//   2. anchor-lang / anchor-spl versions across programs match the value
//      declared in repo-guard.toml [cargo] - no cross-program drift.
//   3. `solana-program` crate pin in launchpads must match the value in
//      [cargo].solana_program_version. Distinct from any CLI version.
//   4. Anchor.toml [toolchain].solana_version must match
//      [toolchain].local_dev_solana_version.
//   5. Crates.io minimum age (scoped to PR-introduced version changes).
//   6. Yarn package.json files use exact versions (no ^, ~, ranges).
//   7. npm registry minimum age for new yarn pins.
//   8. anchor-version in every workflow is [toolchain].anchor_version.
//      solana-cli-version is checked per-file against
//      [toolchain.workflow_solana_cli]. Workflows not in the map are
//      assumed to read versions from Cargo.lock (e.g. reusable-build.yaml).
//   9. Every third-party GitHub Action is pinned to a SHA from the
//      [actions.sha_allowlist] in repo-guard.toml. actions/* (GitHub-owned)
//      are exempt.
//  10. Sensitive-diff heuristics (review-assist, not a merge gate):
//      changes to declare_id! literals, #[error_code] enums, Anchor.toml
//      [programs.*], or files listed in [sensitive_diff.files].
//
// Lockfile freshness (Cargo.lock + yarn.lock) is checked by the workflow
// directly via `cargo metadata --locked` and `yarn install --frozen-lockfile`,
// so it cannot be bypassed even if this script is disabled.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// --- Types ---

type CheckStatus = "pass" | "fail" | "skip" | "warn";

type GuardConfig = {
  anchorVersion: string;
  localDevSolanaVersion: string;
  workflowSolanaCli: Map<string, string>;
  anchorLangVersion: string;
  anchorSplVersion: string;
  solanaProgramVersion: string;
  packageMinAgeDays: number;
  actionShaAllowlist: Map<string, Set<string>>;
  sensitiveFiles: Set<string>;
  excludePaths: string[];
};

type CargoViolation = {
  file: string;
  dependency: string;
  reason: string;
  spec: string;
};

type CrossProgramViolation = {
  dependency: string;
  expected: string;
  variants: Array<{ file: string; spec: string }>;
};

type WorkflowVersionViolation = {
  file: string;
  line: number;
  key: "anchor-version" | "solana-cli-version";
  actual: string;
  expected: string;
};

type WorkflowActionViolation = {
  file: string;
  line: number;
  action: string;
  reason: string;
};

type PackageJsonViolation = {
  file: string;
  section: string;
  dependency: string;
  spec: string;
};

type CrateAgeViolation = {
  crate: string;
  version: string;
  publishedAt: string;
  ageDays: number;
  usedIn: string[];
};

type NpmAgeViolation = {
  dependency: string;
  version: string;
  publishedAt: string;
  ageDays: number;
  usedIn: string[];
};

type SensitiveFinding = {
  file: string;
  line: number;
  kind: string;
  text: string;
};

// --- Constants ---

const ROOT = process.cwd();
const SUMMARY_PATH =
  process.env.REPO_GUARD_SUMMARY_PATH ??
  join(process.env.TMPDIR ?? "/tmp", "repo-guard-summary.md");
const BASE_REF = process.env.GITHUB_BASE_REF ?? "";
const IS_CI = process.env.CI === "true";
const CONFIG_PATH = join(ROOT, ".github", "repo-guard.toml");

const cargoExactPattern =
  /^=\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const npmExactPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const sha40Pattern = /^[0-9a-f]{40}$/;

const cargoIgnoredDirectories = new Set([".git", "target", "node_modules"]);
const packageJsonIgnored = new Set([".git", "node_modules", "dist", "target"]);

// Surfaces where heuristics should ignore matches; this file declares the
// rules themselves.
const sensitiveExcludedFiles = new Set([
  "scripts/repo-guard.ts",
  ".github/repo-guard.toml",
  ".github/CODEOWNERS",
  ".github/workflows/repo-guard.yml",
]);

// --- Tiny TOML reader ---
//
// The config file is intentionally simple: flat tables + the
// [actions.sha_allowlist] sub-table. We avoid a TOML dependency to keep
// the script's surface area small. Supports: `key = "string"`,
// `key = number`, `key = ["a", "b"]`, `[section]`, `[section.sub]`,
// quoted keys.

type TomlValue = string | number | string[];

function parseToml(text: string): Record<string, Record<string, TomlValue>> {
  const result: Record<string, Record<string, TomlValue>> = {};
  let currentSection: Record<string, TomlValue> | null = null;
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const line = raw.replace(/\s*#.*$/, "").trim();
    if (!line) continue;

    const sectionMatch = line.match(/^\[([A-Za-z0-9_.]+)\]$/);
    if (sectionMatch) {
      const name = sectionMatch[1]!;
      result[name] = result[name] ?? {};
      currentSection = result[name]!;
      continue;
    }

    if (!currentSection) {
      throw new Error(`repo-guard.toml line ${i + 1}: value outside section`);
    }

    const keyMatch = line.match(/^(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*=\s*(.+)$/);
    if (!keyMatch) {
      throw new Error(`repo-guard.toml line ${i + 1}: cannot parse: ${line}`);
    }
    const key = keyMatch[1] ?? keyMatch[2]!;
    let valuePart = keyMatch[3]!;

    if (valuePart.startsWith("[") && !valuePart.endsWith("]")) {
      // multi-line array
      let buffer = valuePart;
      while (!buffer.trimEnd().endsWith("]") && i + 1 < lines.length) {
        i += 1;
        const next = lines[i]!.replace(/\s*#.*$/, "");
        buffer += " " + next.trim();
      }
      valuePart = buffer;
    }

    if (valuePart.startsWith("[")) {
      const inner = valuePart.slice(1, valuePart.lastIndexOf("]"));
      const items: string[] = [];
      for (const part of inner.split(",")) {
        const p = part.trim().replace(/,$/, "");
        if (!p) continue;
        const sm = p.match(/^"([^"]*)"$/);
        if (!sm) {
          throw new Error(
            `repo-guard.toml line ${i + 1}: array item not a string: ${p}`,
          );
        }
        items.push(sm[1]!);
      }
      currentSection[key] = items;
      continue;
    }

    if (/^\d+$/.test(valuePart)) {
      currentSection[key] = Number.parseInt(valuePart, 10);
      continue;
    }

    const strMatch = valuePart.match(/^"([^"]*)"$/);
    if (strMatch) {
      currentSection[key] = strMatch[1]!;
      continue;
    }

    throw new Error(
      `repo-guard.toml line ${i + 1}: unsupported value: ${valuePart}`,
    );
  }

  return result;
}

function loadConfig(): GuardConfig {
  const text = readFileSync(CONFIG_PATH, "utf8");
  const toml = parseToml(text);

  const requireString = (section: string, key: string): string => {
    const v = toml[section]?.[key];
    if (typeof v !== "string") {
      throw new Error(`repo-guard.toml: missing string ${section}.${key}`);
    }
    return v;
  };
  const requireNumber = (section: string, key: string): number => {
    const v = toml[section]?.[key];
    if (typeof v !== "number") {
      throw new Error(`repo-guard.toml: missing number ${section}.${key}`);
    }
    return v;
  };

  const allowlist = new Map<string, Set<string>>();
  for (const [k, v] of Object.entries(toml["actions.sha_allowlist"] ?? {})) {
    if (!Array.isArray(v)) {
      throw new Error(
        `repo-guard.toml: actions.sha_allowlist.${k} must be array of strings`,
      );
    }
    allowlist.set(k, new Set(v));
  }

  const sensitiveFiles = new Set<string>();
  const sd = toml["sensitive_diff"]?.["files"];
  if (Array.isArray(sd)) {
    for (const f of sd) sensitiveFiles.add(f);
  }

  const excludePaths: string[] = [];
  const ep = toml["sensitive_diff"]?.["exclude_paths"];
  if (Array.isArray(ep)) {
    for (const p of ep) excludePaths.push(p);
  }

  const workflowSolanaCli = new Map<string, string>();
  for (const [k, v] of Object.entries(
    toml["toolchain.workflow_solana_cli"] ?? {},
  )) {
    if (typeof v !== "string") {
      throw new Error(
        `repo-guard.toml: toolchain.workflow_solana_cli.${k} must be a string`,
      );
    }
    workflowSolanaCli.set(k, v);
  }

  return {
    anchorVersion: requireString("toolchain", "anchor_version"),
    localDevSolanaVersion: requireString(
      "toolchain",
      "local_dev_solana_version",
    ),
    workflowSolanaCli,
    anchorLangVersion: requireString("cargo", "anchor_lang_version"),
    anchorSplVersion: requireString("cargo", "anchor_spl_version"),
    solanaProgramVersion: requireString("cargo", "solana_program_version"),
    packageMinAgeDays: requireNumber("cargo", "package_min_age_days"),
    actionShaAllowlist: allowlist,
    sensitiveFiles,
    excludePaths,
  };
}

// --- Shell helpers ---

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024, // 16 MiB — clears every realistic PR (worst case ~7.5 MB raw)
  }).trim();
}

function getDiffBase(): string | null {
  if (!BASE_REF) return null;
  try {
    return run("git", ["merge-base", "HEAD", `origin/${BASE_REF}`]);
  } catch {
    return null;
  }
}

function readFileAtRef(ref: string, filePath: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${filePath}`], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

// --- File walkers ---

function walkCargoToml(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (cargoIgnoredDirectories.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkCargoToml(full, acc);
      continue;
    }
    if (entry.isFile() && entry.name === "Cargo.toml") {
      acc.push(relative(ROOT, full));
    }
  }
  return acc;
}

function walkPackageJson(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (packageJsonIgnored.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPackageJson(full, acc);
      continue;
    }
    if (entry.isFile() && entry.name === "package.json") {
      acc.push(relative(ROOT, full));
    }
  }
  return acc;
}

// --- Cargo dep parser ---
//
// Hand-rolled because we need line numbers for annotations and the
// surface is small. Walks the `[dependencies]` table of each Cargo.toml
// and emits one entry per dep with the version spec and its location.

type CargoDep = {
  file: string;
  line: number;
  name: string;
  spec: string | null; // null if path/git/workspace dep with no version
  isPath: boolean;
  isGit: boolean;
  gitRev: string | null;
};

function parseCargoToml(file: string): CargoDep[] {
  const text = readFileSync(join(ROOT, file), "utf8");
  const lines = text.split("\n");
  const deps: CargoDep[] = [];
  let inDeps = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!;
    const stripped = raw.replace(/\s*#.*$/, "").trimEnd();
    if (!stripped) continue;

    const section = stripped.match(/^\[([^\]]+)\]$/);
    if (section) {
      inDeps = /^(dependencies|dev-dependencies|build-dependencies)$/.test(
        section[1]!,
      );
      continue;
    }

    if (!inDeps) continue;

    const m = stripped.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!m) continue;

    const name = m[1]!;
    const rhs = m[2]!.trim();

    if (rhs.startsWith('"') && rhs.endsWith('"')) {
      deps.push({
        file,
        line: i + 1,
        name,
        spec: rhs.slice(1, -1),
        isPath: false,
        isGit: false,
        gitRev: null,
      });
      continue;
    }

    if (rhs.startsWith("{") && rhs.endsWith("}")) {
      const inner = rhs.slice(1, -1);
      const pathField = inner.match(/path\s*=\s*"([^"]+)"/);
      const gitField = inner.match(/git\s*=\s*"([^"]+)"/);
      const verField = inner.match(/version\s*=\s*"([^"]+)"/);
      const revField = inner.match(/rev\s*=\s*"([^"]+)"/);
      deps.push({
        file,
        line: i + 1,
        name,
        spec: verField?.[1] ?? null,
        isPath: !!pathField,
        isGit: !!gitField,
        gitRev: revField?.[1] ?? null,
      });
      continue;
    }
  }

  return deps;
}

// --- Cargo checks ---

function checkCargoExactPinning(config: GuardConfig): {
  status: CheckStatus;
  violations: CargoViolation[];
  exactDependencies: Map<string, Set<string>>; // "name@version" -> set of "file:line"
} {
  const files = walkCargoToml(join(ROOT, "programs"), []);
  const violations: CargoViolation[] = [];
  const exact = new Map<string, Set<string>>();

  for (const file of files) {
    const deps = parseCargoToml(file);
    for (const dep of deps) {
      if (dep.isPath) continue;
      if (dep.isGit) {
        if (!dep.gitRev || !sha40Pattern.test(dep.gitRev)) {
          violations.push({
            file,
            dependency: dep.name,
            reason: "git dep without 40-char rev SHA",
            spec: dep.gitRev ?? "(no rev)",
          });
        }
        continue;
      }
      if (!dep.spec) {
        violations.push({
          file,
          dependency: dep.name,
          reason: "no version, path, or git",
          spec: "(none)",
        });
        continue;
      }
      if (!cargoExactPattern.test(dep.spec)) {
        violations.push({
          file,
          dependency: dep.name,
          reason: "non-exact version spec (must be =x.y.z)",
          spec: dep.spec,
        });
        continue;
      }
      const version = dep.spec.slice(1);
      const key = `${dep.name}@${version}`;
      const set = exact.get(key) ?? new Set<string>();
      set.add(`${file}:${dep.line}`);
      exact.set(key, set);
    }
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
    exactDependencies: exact,
  };
}

function checkCrossProgramConsistency(config: GuardConfig): {
  status: CheckStatus;
  violations: CrossProgramViolation[];
} {
  const files = walkCargoToml(join(ROOT, "programs"), []);
  const seen = new Map<
    string,
    Map<string, Array<{ file: string; spec: string }>>
  >();

  const watched = new Map<string, string>([
    ["anchor-lang", config.anchorLangVersion],
    ["anchor-spl", config.anchorSplVersion],
  ]);

  for (const file of files) {
    const deps = parseCargoToml(file);
    for (const dep of deps) {
      if (!watched.has(dep.name)) continue;
      if (!dep.spec) continue;
      const versionOnly = dep.spec.replace(/^=/, "");
      const perDep = seen.get(dep.name) ?? new Map();
      const arr = perDep.get(versionOnly) ?? [];
      arr.push({ file, spec: dep.spec });
      perDep.set(versionOnly, arr);
      seen.set(dep.name, perDep);
    }
  }

  const violations: CrossProgramViolation[] = [];
  for (const [name, expected] of watched) {
    const perDep = seen.get(name);
    if (!perDep) continue;
    for (const [version, instances] of perDep.entries()) {
      if (version !== expected) {
        violations.push({
          dependency: name,
          expected,
          variants: instances,
        });
      }
    }
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };
}

// --- Crates.io age check ---

async function fetchCratePublishTime(
  crate: string,
  version: string,
): Promise<string> {
  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crate)}/${encodeURIComponent(version)}`;
  // crates.io requires a descriptive User-Agent. Without it the API returns
  // 403. See https://crates.io/policies#crawlers
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "metadao-repo-guard (https://github.com/metaDAOproject/programs)",
    },
  });
  if (!response.ok) {
    throw new Error(
      `crates.io returned ${response.status} for ${crate}@${version}`,
    );
  }
  const meta = (await response.json()) as { version?: { created_at?: string } };
  const at = meta.version?.created_at;
  if (!at) {
    throw new Error(`crates.io: no created_at for ${crate}@${version}`);
  }
  return at;
}

function filterCratesToPRChanges(
  all: Map<string, Set<string>>,
  diffBase: string,
): Map<string, Set<string>> {
  const changed = new Map<string, Set<string>>();
  for (const [key, locations] of all.entries()) {
    const atIdx = key.lastIndexOf("@");
    const name = key.slice(0, atIdx);
    const headVersion = key.slice(atIdx + 1);

    for (const loc of locations) {
      const file = loc.split(":")[0]!;
      const baseText = readFileAtRef(diffBase, file);
      if (baseText === null) {
        const s = changed.get(key) ?? new Set<string>();
        s.add(loc);
        changed.set(key, s);
        continue;
      }
      let baseVersion: string | null = null;
      try {
        const tmpFile = file;
        // parse base copy: write to memory and reuse parseCargoToml? easier:
        // do an inline parse here.
        const lines = baseText.split("\n");
        let inDeps = false;
        for (const raw of lines) {
          const stripped = raw.replace(/\s*#.*$/, "").trimEnd();
          const section = stripped.match(/^\[([^\]]+)\]$/);
          if (section) {
            inDeps =
              /^(dependencies|dev-dependencies|build-dependencies)$/.test(
                section[1]!,
              );
            continue;
          }
          if (!inDeps) continue;
          const m = stripped.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
          if (!m || m[1] !== name) continue;
          const rhs = m[2]!.trim();
          if (rhs.startsWith('"') && rhs.endsWith('"')) {
            baseVersion = rhs.slice(1, -1).replace(/^=/, "");
          } else if (rhs.startsWith("{")) {
            const v = rhs.match(/version\s*=\s*"([^"]+)"/);
            if (v) baseVersion = v[1]!.replace(/^=/, "");
          }
          break;
        }
      } catch {
        // fall through; treat as changed
      }
      if (baseVersion === headVersion) continue;
      const s = changed.get(key) ?? new Set<string>();
      s.add(loc);
      changed.set(key, s);
    }
  }
  return changed;
}

async function checkCrateAge(
  config: GuardConfig,
  exactDeps: Map<string, Set<string>>,
): Promise<{
  status: CheckStatus;
  violations: CrateAgeViolation[];
  reason?: string;
}> {
  const diffBase = getDiffBase();
  if (!diffBase) {
    return {
      status: "skip",
      violations: [],
      reason: "no PR base ref (GITHUB_BASE_REF) available",
    };
  }

  const scoped = filterCratesToPRChanges(exactDeps, diffBase);
  const now = Date.now();
  const violations: CrateAgeViolation[] = [];

  try {
    for (const [key, locations] of [...scoped.entries()].sort()) {
      const atIdx = key.lastIndexOf("@");
      const name = key.slice(0, atIdx);
      const version = key.slice(atIdx + 1);
      const publishedAt = await fetchCratePublishTime(name, version);
      const ageDays = Math.floor(
        (now - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (ageDays >= config.packageMinAgeDays) continue;
      violations.push({
        crate: name,
        version,
        publishedAt,
        ageDays,
        usedIn: [...locations].sort(),
      });
    }
  } catch (error) {
    if (IS_CI) throw error;
    return {
      status: "skip",
      violations: [],
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };
}

// --- Yarn package.json checks ---

const npmDepSections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "resolutions",
];

function shouldPinNpmSpec(spec: string): boolean {
  // skip non-registry refs - they're pinned by other means
  return !(
    spec.startsWith("file:") ||
    spec.startsWith("link:") ||
    spec.startsWith("workspace:") ||
    spec.startsWith("./") ||
    spec.startsWith("../") ||
    spec.startsWith("git+") ||
    spec.startsWith("git:") ||
    spec.startsWith("http://") ||
    spec.startsWith("https://")
  );
}

function checkPackageJsonPinning(): {
  status: CheckStatus;
  violations: PackageJsonViolation[];
  exactDependencies: Map<string, Set<string>>;
} {
  const files = walkPackageJson(ROOT, []);
  const violations: PackageJsonViolation[] = [];
  const exact = new Map<string, Set<string>>();

  for (const file of files) {
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(join(ROOT, file), "utf8"));
    } catch {
      continue;
    }

    for (const section of npmDepSections) {
      const deps = pkg[section];
      if (!deps || typeof deps !== "object") continue;
      for (const [name, spec] of Object.entries(
        deps as Record<string, unknown>,
      )) {
        if (typeof spec !== "string") continue;
        if (!shouldPinNpmSpec(spec)) continue;
        if (!npmExactPattern.test(spec)) {
          violations.push({ file, section, dependency: name, spec });
          continue;
        }
        const key = `${name}@${spec}`;
        const set = exact.get(key) ?? new Set<string>();
        set.add(`${file} (${section})`);
        exact.set(key, set);
      }
    }
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
    exactDependencies: exact,
  };
}

async function fetchNpmPublishTime(
  name: string,
  version: string,
): Promise<string> {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(`npm registry returned ${response.status} for ${name}`);
  }
  const meta = (await response.json()) as { time?: Record<string, string> };
  const at = meta.time?.[version];
  if (!at) {
    throw new Error(`npm: no publish time for ${name}@${version}`);
  }
  return at;
}

function filterNpmDepsToChanges(
  all: Map<string, Set<string>>,
  diffBase: string,
): Map<string, Set<string>> {
  const locationPattern = /^(.+) \((\w+)\)$/;
  const changed = new Map<string, Set<string>>();

  for (const [key, locations] of all.entries()) {
    const atIdx = key.lastIndexOf("@");
    const name = key.slice(0, atIdx);
    const headVersion = key.slice(atIdx + 1);

    for (const loc of locations) {
      const m = loc.match(locationPattern);
      if (!m) continue;
      const file = m[1]!;
      const section = m[2]!;

      const baseText = readFileAtRef(diffBase, file);
      if (baseText === null) {
        const s = changed.get(key) ?? new Set<string>();
        s.add(loc);
        changed.set(key, s);
        continue;
      }
      let baseVersion: unknown = null;
      try {
        const basePkg = JSON.parse(baseText) as Record<string, unknown>;
        const baseSection = basePkg[section];
        if (baseSection && typeof baseSection === "object") {
          baseVersion = (baseSection as Record<string, unknown>)[name];
        }
      } catch {
        // fall through
      }
      if (baseVersion === headVersion) continue;
      const s = changed.get(key) ?? new Set<string>();
      s.add(loc);
      changed.set(key, s);
    }
  }
  return changed;
}

async function checkNpmAge(
  config: GuardConfig,
  exactDeps: Map<string, Set<string>>,
): Promise<{
  status: CheckStatus;
  violations: NpmAgeViolation[];
  reason?: string;
}> {
  const diffBase = getDiffBase();
  if (!diffBase) {
    return {
      status: "skip",
      violations: [],
      reason: "no PR base ref available",
    };
  }

  const scoped = filterNpmDepsToChanges(exactDeps, diffBase);
  const now = Date.now();
  const violations: NpmAgeViolation[] = [];

  try {
    for (const [key, locations] of [...scoped.entries()].sort()) {
      const atIdx = key.lastIndexOf("@");
      const name = key.slice(0, atIdx);
      const version = key.slice(atIdx + 1);
      const publishedAt = await fetchNpmPublishTime(name, version);
      const ageDays = Math.floor(
        (now - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (ageDays >= config.packageMinAgeDays) continue;
      violations.push({
        dependency: name,
        version,
        publishedAt,
        ageDays,
        usedIn: [...locations].sort(),
      });
    }
  } catch (error) {
    if (IS_CI) throw error;
    return {
      status: "skip",
      violations: [],
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };
}

// --- Workflow checks ---

function listWorkflowFiles(): string[] {
  const acc: string[] = [];
  for (const dir of [
    join(ROOT, ".github", "workflows"),
    join(ROOT, ".github", "actions"),
  ]) {
    if (!existsSync(dir)) continue;
    walkYaml(dir, acc);
  }
  return acc;
}

function walkYaml(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkYaml(full, acc);
      continue;
    }
    if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
      acc.push(relative(ROOT, full));
    }
  }
}

function checkWorkflowToolchain(config: GuardConfig): {
  status: CheckStatus;
  violations: WorkflowVersionViolation[];
} {
  const files = listWorkflowFiles();
  const violations: WorkflowVersionViolation[] = [];

  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    // Per-file expected Solana CLI version. Workflows not in the map are
    // dynamic (e.g. reusable-build.yaml reads from Cargo.lock) - we don't
    // enforce a value for those.
    const expectedSolana = config.workflowSolanaCli.get(file);

    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i]!;
      const stripped = raw.split("#")[0]!;
      // Quoted literal value: anchor-version: '0.29.0' or "0.29.0".
      // `${{ inputs.* }}` template references don't have quotes, so they
      // are skipped by this regex.
      const a = stripped.match(/\banchor-version\s*:\s*['"]([^'"]+)['"]/);
      const s = stripped.match(/\bsolana-cli-version\s*:\s*['"]([^'"]+)['"]/);
      if (a) {
        const actual = a[1]!;
        if (actual !== config.anchorVersion) {
          violations.push({
            file,
            line: i + 1,
            key: "anchor-version",
            actual,
            expected: config.anchorVersion,
          });
        }
      }
      if (s && expectedSolana !== undefined) {
        const actual = s[1]!;
        if (actual !== expectedSolana) {
          violations.push({
            file,
            line: i + 1,
            key: "solana-cli-version",
            actual,
            expected: expectedSolana,
          });
        }
      }
    }
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };
}

// `solana-program` crate pin in launchpads. Must match
// [cargo].solana_program_version exactly across every program that
// declares it. Programs that don't declare `solana-program` rely on
// anchor-lang's transitive dep - not our concern here.
function checkSolanaProgramCrate(config: GuardConfig): {
  status: CheckStatus;
  violations: Array<{
    file: string;
    line: number;
    spec: string;
    expected: string;
  }>;
} {
  const files = walkCargoToml(join(ROOT, "programs"), []);
  const violations: Array<{
    file: string;
    line: number;
    spec: string;
    expected: string;
  }> = [];

  for (const file of files) {
    const deps = parseCargoToml(file);
    for (const dep of deps) {
      if (dep.name !== "solana-program") continue;
      if (!dep.spec) continue;
      const version = dep.spec.replace(/^=/, "");
      if (version !== config.solanaProgramVersion) {
        violations.push({
          file,
          line: dep.line,
          spec: dep.spec,
          expected: `=${config.solanaProgramVersion}`,
        });
      }
    }
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };
}

// Anchor.toml [toolchain].solana_version is what `anchor test` auto-installs
// on a local-dev machine. CI workflows don't read it (they pass
// solana-cli-version explicitly), but we still lock it down so the value
// stays predictable.
function checkAnchorTomlSolanaVersion(config: GuardConfig): {
  status: CheckStatus;
  actual: string | null;
  expected: string;
} {
  const anchorTomlPath = join(ROOT, "Anchor.toml");
  if (!existsSync(anchorTomlPath)) {
    return {
      status: "skip",
      actual: null,
      expected: config.localDevSolanaVersion,
    };
  }
  const text = readFileSync(anchorTomlPath, "utf8");
  const match = text.match(/^\s*solana_version\s*=\s*"([^"]+)"/m);
  if (!match) {
    return {
      status: "skip",
      actual: null,
      expected: config.localDevSolanaVersion,
    };
  }
  const actual = match[1]!;
  return {
    status: actual === config.localDevSolanaVersion ? "pass" : "fail",
    actual,
    expected: config.localDevSolanaVersion,
  };
}

function checkWorkflowActionPinning(config: GuardConfig): {
  status: CheckStatus;
  violations: WorkflowActionViolation[];
} {
  const files = listWorkflowFiles();
  const violations: WorkflowActionViolation[] = [];

  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const raw = lines[i]!;
      // strip trailing comment (the SHA-pin format keeps the tag in a #-comment)
      const usesMatch = raw.match(/\buses:\s*([^\s#]+)/);
      if (!usesMatch) continue;
      const ref = usesMatch[1]!;
      if (ref.startsWith("./")) continue; // local composite action
      const atIdx = ref.lastIndexOf("@");
      if (atIdx < 0) continue;
      const repoPath = ref.slice(0, atIdx);
      const rev = ref.slice(atIdx + 1);
      // owner from "owner/repo" or "owner/repo/sub"
      const slash = repoPath.indexOf("/");
      const owner = slash > 0 ? repoPath.slice(0, slash) : repoPath;

      // GitHub-owned actions are allowed to stay tag-pinned.
      if (owner === "actions") continue;

      // For nested paths (e.g. solana-developers/github-actions/extract-versions),
      // the allowlist is keyed by "owner/repo" - the top-level repo.
      const repoEnd = repoPath.indexOf("/", slash + 1);
      const repoKey = repoEnd > 0 ? repoPath.slice(0, repoEnd) : repoPath;

      if (!sha40Pattern.test(rev)) {
        violations.push({
          file,
          line: i + 1,
          action: ref,
          reason: "third-party action must be SHA-pinned (40 hex chars)",
        });
        continue;
      }

      const allowed = config.actionShaAllowlist.get(repoKey);
      if (!allowed || !allowed.has(rev)) {
        violations.push({
          file,
          line: i + 1,
          action: ref,
          reason: `SHA not in [actions.sha_allowlist] for ${repoKey}`,
        });
      }
    }
  }

  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };
}

// --- Sensitive-diff (review-assist) ---

const sensitiveRules: Array<{ kind: string; pattern: RegExp }> = [
  {
    kind: "declare_id! literal change",
    pattern: /\bdeclare_id!\s*\(\s*["'][^"']+["']\s*\)/,
  },
  {
    kind: "#[error_code] enum modification",
    pattern: /^\s*#\[(?:error_code|error)\]/,
  },
  {
    kind: "Hardcoded Solana address literal",
    pattern: /["'`](?:[1-9A-HJ-NP-Za-km-z]{32,44})["'`]/,
  },
  {
    kind: "Program ID constant or variable change",
    pattern: /\b(?:PROGRAM_ID|program_id)\b/,
  },
  {
    kind: "Anchor [programs.*] entry change",
    pattern: /^\s*[a-z_][a-z0-9_]*\s*=\s*"[1-9A-HJ-NP-Za-km-z]{32,44}"/,
  },
  {
    kind: "Unsafe block introduced or modified",
    pattern: /\bunsafe\s*\{/,
  },
];

function checkSensitiveDiff(config: GuardConfig): {
  status: CheckStatus;
  findings: SensitiveFinding[];
  touchedSensitiveFiles: string[];
} {
  const diffBase = getDiffBase();
  if (!diffBase) {
    return { status: "skip", findings: [], touchedSensitiveFiles: [] };
  }

  const changedFiles = new Set(
    run("git", ["diff", "--name-only", `${diffBase}...HEAD`])
      .split("\n")
      .filter(Boolean),
  );
  const touchedSensitiveFiles = [...config.sensitiveFiles].filter((f) =>
    changedFiles.has(f),
  );

  const diff = run("git", [
    "diff",
    "--unified=0",
    "--no-color",
    `${diffBase}...HEAD`,
    "--",
    ".",
    ...config.excludePaths.map((p) => `:(exclude)${p}`),
  ]);

  const findings: SensitiveFinding[] = [];
  let currentFile = "";
  let nextLine = 0;

  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("+++ b/")) {
      currentFile = rawLine.slice(6);
      continue;
    }
    if (rawLine.startsWith("@@")) {
      const m = rawLine.match(/\+(\d+)(?:,(\d+))?/);
      nextLine = m ? Number.parseInt(m[1]!, 10) : 0;
      continue;
    }
    if (sensitiveExcludedFiles.has(currentFile)) continue;
    if (/\.(md|mdx|txt|rst)$/i.test(currentFile)) continue;

    if (!rawLine.startsWith("+") || rawLine.startsWith("+++")) {
      if (rawLine.startsWith("-") && !rawLine.startsWith("---")) continue;
      if (!rawLine.startsWith("-")) continue;
    }

    const sign = rawLine[0]!;
    const text = rawLine.slice(1);
    if (!currentFile || !text.trim()) {
      if (sign === "+") nextLine += 1;
      continue;
    }

    const kinds = sensitiveRules
      .filter((r) => r.pattern.test(text))
      .map((r) => r.kind);
    if (kinds.length > 0) {
      findings.push({
        file: currentFile,
        line: nextLine,
        kind: kinds.join("; "),
        text: `${sign}${text}`.trim(),
      });
    }
    if (sign === "+") nextLine += 1;
  }

  if (findings.length === 0 && touchedSensitiveFiles.length === 0) {
    return { status: "pass", findings, touchedSensitiveFiles };
  }
  return { status: "warn", findings, touchedSensitiveFiles };
}

// --- Render ---

function fmtPath(p: string): string {
  return `\`${p}\``;
}

function renderHeader(title: string, status: CheckStatus): string[] {
  return [`### ${title}`, "", `- Status: ${status}`];
}

function renderCargoPinning(
  r: ReturnType<typeof checkCargoExactPinning>,
): string[] {
  const lines = renderHeader("Cargo dependency pinning", r.status);
  if (r.status === "pass") {
    lines.push(
      "- Every `programs/*/Cargo.toml` dep uses `=x.y.z`, a `path = ..` workspace ref, or a git dep with a 40-char `rev`.",
    );
    return lines;
  }
  lines.push("- The following Cargo entries are not exact:");
  for (const v of r.violations) {
    lines.push(
      `- ${fmtPath(v.file)} -> \`${v.dependency}\`: ${v.reason}; spec: \`${v.spec}\``,
    );
  }
  return lines;
}

function renderCrossProgram(
  r: ReturnType<typeof checkCrossProgramConsistency>,
): string[] {
  const lines = renderHeader(
    "Cross-program Anchor/Solana version consistency",
    r.status,
  );
  if (r.status === "pass") {
    lines.push(
      "- `anchor-lang` and `anchor-spl` are pinned to the version declared in `repo-guard.toml` across every program.",
    );
    return lines;
  }
  for (const v of r.violations) {
    lines.push(`- \`${v.dependency}\` expected \`=${v.expected}\` but found:`);
    for (const inst of v.variants) {
      lines.push(`  - ${fmtPath(inst.file)} uses \`${inst.spec}\``);
    }
  }
  return lines;
}

function renderCrateAge(
  r: Awaited<ReturnType<typeof checkCrateAge>>,
  config: GuardConfig,
): string[] {
  const lines = renderHeader("Crate minimum age", r.status);
  if (r.status === "pass") {
    lines.push(
      `- All Cargo deps changed by this PR are at least ${config.packageMinAgeDays} days old on crates.io.`,
    );
    return lines;
  }
  if (r.status === "skip") {
    lines.push(`- Skipped: ${r.reason}`);
    return lines;
  }
  lines.push(
    `- The following crates are newer than ${config.packageMinAgeDays} days:`,
  );
  for (const v of r.violations) {
    lines.push(
      `- \`${v.crate}@${v.version}\` is ${v.ageDays} days old (published ${v.publishedAt}); used in ${v.usedIn.map(fmtPath).join(", ")}`,
    );
  }
  return lines;
}

function renderPackageJson(
  r: ReturnType<typeof checkPackageJsonPinning>,
): string[] {
  const lines = renderHeader("Yarn package.json pinning", r.status);
  if (r.status === "pass") {
    lines.push(
      "- All `package.json` deps use exact versions (no `^`, `~`, ranges).",
    );
    return lines;
  }
  for (const v of r.violations) {
    lines.push(
      `- ${fmtPath(v.file)} -> \`${v.section}.${v.dependency}\` uses \`${v.spec}\``,
    );
  }
  return lines;
}

function renderNpmAge(
  r: Awaited<ReturnType<typeof checkNpmAge>>,
  config: GuardConfig,
): string[] {
  const lines = renderHeader("npm minimum age", r.status);
  if (r.status === "pass") {
    lines.push(
      `- All npm deps changed by this PR are at least ${config.packageMinAgeDays} days old.`,
    );
    return lines;
  }
  if (r.status === "skip") {
    lines.push(`- Skipped: ${r.reason}`);
    return lines;
  }
  for (const v of r.violations) {
    lines.push(
      `- \`${v.dependency}@${v.version}\` is ${v.ageDays} days old (published ${v.publishedAt}); used in ${v.usedIn.map(fmtPath).join(", ")}`,
    );
  }
  return lines;
}

function renderWorkflowToolchain(
  r: ReturnType<typeof checkWorkflowToolchain>,
  config: GuardConfig,
): string[] {
  const lines = renderHeader("Workflow toolchain consistency", r.status);
  if (r.status === "pass") {
    lines.push(
      `- Every workflow declares \`anchor-version: ${config.anchorVersion}\`.`,
    );
    lines.push(
      "- Per-file \`solana-cli-version\` values match \`[toolchain.workflow_solana_cli]\` in \`repo-guard.toml\`.",
    );
    return lines;
  }
  for (const v of r.violations) {
    lines.push(
      `- ${fmtPath(v.file)}:${v.line} has \`${v.key}: ${v.actual}\`, expected \`${v.expected}\``,
    );
  }
  return lines;
}

function renderSolanaProgramCrate(
  r: ReturnType<typeof checkSolanaProgramCrate>,
  config: GuardConfig,
): string[] {
  const lines = renderHeader("solana-program crate pin", r.status);
  if (r.status === "pass") {
    lines.push(
      `- Every \`solana-program = "=X"\` declaration is \`=${config.solanaProgramVersion}\` (locked to match \`Cargo.lock\`).`,
    );
    return lines;
  }
  for (const v of r.violations) {
    lines.push(
      `- ${fmtPath(v.file)}:${v.line} has \`solana-program = "${v.spec}"\`, expected \`${v.expected}\``,
    );
  }
  return lines;
}

function renderAnchorTomlSolanaVersion(
  r: ReturnType<typeof checkAnchorTomlSolanaVersion>,
): string[] {
  const lines = renderHeader("Anchor.toml solana_version", r.status);
  if (r.status === "pass") {
    lines.push(
      `- \`Anchor.toml\` declares \`solana_version = "${r.expected}"\` (local-dev install for \`anchor test\`).`,
    );
    return lines;
  }
  if (r.status === "skip") {
    lines.push("- Skipped: `Anchor.toml` has no `solana_version` field.");
    return lines;
  }
  lines.push(
    `- \`Anchor.toml\` declares \`solana_version = "${r.actual ?? "(missing)"}"\`, expected \`"${r.expected}"\``,
  );
  return lines;
}

function renderActionPinning(
  r: ReturnType<typeof checkWorkflowActionPinning>,
): string[] {
  const lines = renderHeader("GitHub Action SHA pinning", r.status);
  if (r.status === "pass") {
    lines.push(
      "- Every third-party action is pinned to a SHA in `[actions.sha_allowlist]`.",
    );
    return lines;
  }
  for (const v of r.violations) {
    lines.push(`- ${fmtPath(v.file)}:${v.line} \`${v.action}\`: ${v.reason}`);
  }
  return lines;
}

function renderSensitive(r: ReturnType<typeof checkSensitiveDiff>): string[] {
  const lines = renderHeader("Sensitive program / config changes", r.status);
  if (r.status === "skip") {
    lines.push("- Skipped: no PR base ref available.");
    return lines;
  }
  if (r.status === "pass") {
    lines.push(
      "- No suspicious changes to program IDs, error enums, or sensitive files detected.",
    );
    return lines;
  }
  lines.push(
    "- Review hint only (CODEOWNERS is the merge gate). Lines below match heuristics for security-sensitive changes:",
  );
  if (r.touchedSensitiveFiles.length > 0) {
    lines.push(
      `- High-sensitivity files touched: ${r.touchedSensitiveFiles.map(fmtPath).join(", ")}`,
    );
  }
  for (const f of r.findings.slice(0, 30)) {
    lines.push(
      `- ${fmtPath(`${f.file}:${f.line}`)} ${f.kind} -> \`${f.text}\``,
    );
  }
  return lines;
}

// --- Main ---

async function main() {
  const config = loadConfig();

  const cargoPinning = checkCargoExactPinning(config);
  const crossProgram = checkCrossProgramConsistency(config);
  const solanaProgramCrate = checkSolanaProgramCrate(config);
  const anchorTomlSolana = checkAnchorTomlSolanaVersion(config);
  const crateAge = await checkCrateAge(config, cargoPinning.exactDependencies);
  const npmPinning = checkPackageJsonPinning();
  const npmAge = await checkNpmAge(config, npmPinning.exactDependencies);
  const workflowToolchain = checkWorkflowToolchain(config);
  const actionPinning = checkWorkflowActionPinning(config);
  const sensitive = checkSensitiveDiff(config);

  const overallFailed =
    cargoPinning.status === "fail" ||
    crossProgram.status === "fail" ||
    solanaProgramCrate.status === "fail" ||
    anchorTomlSolana.status === "fail" ||
    crateAge.status === "fail" ||
    npmPinning.status === "fail" ||
    npmAge.status === "fail" ||
    workflowToolchain.status === "fail" ||
    actionPinning.status === "fail";

  const summary = [
    "## Repository Guard",
    "",
    ...renderCargoPinning(cargoPinning),
    "",
    ...renderCrossProgram(crossProgram),
    "",
    ...renderSolanaProgramCrate(solanaProgramCrate, config),
    "",
    ...renderAnchorTomlSolanaVersion(anchorTomlSolana),
    "",
    ...renderCrateAge(crateAge, config),
    "",
    ...renderPackageJson(npmPinning),
    "",
    ...renderNpmAge(npmAge, config),
    "",
    ...renderWorkflowToolchain(workflowToolchain, config),
    "",
    ...renderActionPinning(actionPinning),
    "",
    ...renderSensitive(sensitive),
    "",
    `Overall status: ${overallFailed ? "fail" : "pass"}`,
    "",
    "_Lockfile freshness (Cargo.lock + yarn.lock) is checked by the workflow directly and cannot be bypassed. The sensitive-diff section is a review hint - CODEOWNERS handles the actual merge gate._",
  ].join("\n");

  writeFileSync(SUMMARY_PATH, summary + "\n");

  // Sensitive findings as ::warning:: annotations
  if (sensitive.status === "warn") {
    for (const f of sensitive.findings.slice(0, 30)) {
      console.log(
        `::warning file=${f.file},line=${f.line}::${f.kind}: ${f.text}`,
      );
    }
    for (const f of sensitive.touchedSensitiveFiles) {
      console.log(
        `::warning file=${f}::High-sensitivity file modified - please review carefully.`,
      );
    }
  }

  if (!overallFailed) {
    console.log(summary);
    return;
  }

  console.error("\nRepository Guard failed.\n");
  console.error(summary);

  for (const v of cargoPinning.violations) {
    console.error(
      `::error file=${v.file}::${v.dependency} ${v.reason} (\`${v.spec}\`)`,
    );
  }
  for (const v of crossProgram.violations) {
    for (const inst of v.variants) {
      console.error(
        `::error file=${inst.file}::${v.dependency} = ${inst.spec}, expected =${v.expected}`,
      );
    }
  }
  for (const v of solanaProgramCrate.violations) {
    console.error(
      `::error file=${v.file},line=${v.line}::solana-program = "${v.spec}", expected "${v.expected}"`,
    );
  }
  if (anchorTomlSolana.status === "fail") {
    console.error(
      `::error file=Anchor.toml::solana_version = "${anchorTomlSolana.actual ?? "(missing)"}", expected "${anchorTomlSolana.expected}"`,
    );
  }
  if (crateAge.status === "fail") {
    for (const v of crateAge.violations) {
      const where = v.usedIn[0]?.split(":")[0] ?? "Cargo.toml";
      console.error(
        `::error file=${where}::${v.crate}@${v.version} is ${v.ageDays} days old (min ${config.packageMinAgeDays}d)`,
      );
    }
  }
  for (const v of npmPinning.violations) {
    console.error(
      `::error file=${v.file}::${v.section}.${v.dependency} uses \`${v.spec}\` - pin to exact`,
    );
  }
  if (npmAge.status === "fail") {
    for (const v of npmAge.violations) {
      const where = v.usedIn[0]?.split(" ")[0] ?? "package.json";
      console.error(
        `::error file=${where}::${v.dependency}@${v.version} is ${v.ageDays} days old (min ${config.packageMinAgeDays}d)`,
      );
    }
  }
  for (const v of workflowToolchain.violations) {
    console.error(
      `::error file=${v.file},line=${v.line}::${v.key}: ${v.actual} (expected ${v.expected})`,
    );
  }
  for (const v of actionPinning.violations) {
    console.error(
      `::error file=${v.file},line=${v.line}::${v.action}: ${v.reason}`,
    );
  }

  process.exit(1);
}

await main();
