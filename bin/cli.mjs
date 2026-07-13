#!/usr/bin/env node
// claude-code-recap: install the recap skill into the Claude Code skills directory.
//
//   npx claude-code-recap             install or update
//   npx claude-code-recap --force     overwrite local edits
//   npx claude-code-recap --uninstall remove what this tool installed
//
// This package never writes anything on `npm install`. There is no postinstall
// hook. It touches the Claude Code config directory only when you run it.

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, "..");
const SKILL_NAME = "recap";
const SRC = path.join(PKG_ROOT, "skills", SKILL_NAME);
const MANIFEST_NAME = ".claude-code-recap-manifest.json";

const CONFIG_DIR =
  process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const DEST = path.join(CONFIG_DIR, "skills", SKILL_NAME);
const MANIFEST = path.join(DEST, MANIFEST_NAME);

const args = process.argv.slice(2);
const has = (...names) => names.some((n) => args.includes(n));

const FORCE = has("--force", "-f");
const UNINSTALL = has("--uninstall");

const HELP = `claude-code-recap: install the recap skill for Claude Code.

Usage:
  npx claude-code-recap [--force]
  npx claude-code-recap --uninstall [--force]

Options:
  --force, -f     overwrite an existing install, even if it has local edits
  --uninstall     remove the files this tool installed
  --version, -v   print the package version
  --help, -h      print this help

Environment:
  CLAUDE_CONFIG_DIR   Claude Code config dir (default: ~/.claude)

Installs to: ${DEST}
`;

function fail(...lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function exists(p) {
  return fs.access(p).then(
    () => true,
    () => false,
  );
}

async function pkgVersion() {
  const pkg = await readJson(path.join(PKG_ROOT, "package.json"));
  return pkg?.version ?? "unknown";
}

// The Agent Skills spec requires SKILL.md `name` to equal its directory name,
// so derive the install directory from the frontmatter instead of trusting a
// second hardcoded copy of the name.
async function skillFrontmatter() {
  const md = await fs.readFile(path.join(SRC, "SKILL.md"), "utf8");
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) fail("skills/recap/SKILL.md has no YAML frontmatter.");
  const name = fm[1].match(/^name:\s*(\S+)\s*$/m)?.[1];
  const version = fm[1]
    .match(/^metadata:\r?\n(?:[ \t]+.*\r?\n?)*/m)?.[0]
    ?.match(/^[ \t]+version:\s*["']?([^"'\s]+)["']?/m)?.[1];
  if (!name) fail("skills/recap/SKILL.md is missing a `name` field.");
  if (name !== SKILL_NAME) {
    fail(`skills/recap/SKILL.md declares name '${name}', expected '${SKILL_NAME}'.`);
  }
  return { name, version: version ?? "unknown" };
}

// Build noise that must never reach the user's skills directory.
const IGNORED_DIRS = new Set(["__pycache__", ".git", "node_modules"]);
const isIgnoredFile = (name) =>
  name === ".DS_Store" || name.endsWith(".pyc") || name.endsWith(".pyo");

// Every shippable file under SRC, as paths relative to SRC.
async function sourceFiles(dir = SRC, prefix = "") {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      out.push(...(await sourceFiles(path.join(dir, entry.name), rel)));
    } else if (entry.isFile() && !isIgnoredFile(entry.name)) {
      out.push(rel);
    }
  }
  return out.sort();
}

async function findEdits(manifest) {
  const edited = [];
  for (const [rel, recorded] of Object.entries(manifest.files ?? {})) {
    try {
      const buf = await fs.readFile(path.join(DEST, rel));
      if (sha256(buf) !== recorded) edited.push(rel);
    } catch {
      // The user deleted it. Not an edit worth protecting.
    }
  }
  return edited;
}

async function removeTracked(manifest) {
  for (const rel of Object.keys(manifest.files ?? {})) {
    await fs.rm(path.join(DEST, rel), { force: true });
  }
  await fs.rm(MANIFEST, { force: true });
}

// Removing tracked files leaves empty subdirectories behind. Left alone they
// look like user content, so the skill directory would never be cleaned up and
// the next install would refuse. Prune bottom-up.
async function pruneEmptyDirs(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) await pruneEmptyDirs(path.join(root, entry.name));
  }
  const left = await fs.readdir(root).catch(() => ["keep"]);
  if (left.length === 0) await fs.rmdir(root).catch(() => {});
}

async function uninstall() {
  if (!(await exists(DEST))) {
    console.log(`recap is not installed (${DEST} does not exist).`);
    return;
  }
  const manifest = await readJson(MANIFEST);

  if (!manifest) {
    if (!FORCE) {
      fail(
        `${DEST} exists but was not installed by this tool (no manifest).`,
        "Refusing to remove it. Re-run with --force to delete it anyway.",
      );
    }
    await fs.rm(DEST, { recursive: true, force: true });
    console.log(`Removed ${DEST} (forced, no manifest).`);
    return;
  }

  const edited = await findEdits(manifest);
  if (edited.length && !FORCE) {
    fail(
      "These installed files have local edits:",
      ...edited.map((f) => `  ${f}`),
      "Refusing to delete them. Back them up, then re-run with --force.",
    );
  }

  await removeTracked(manifest);
  await pruneEmptyDirs(DEST);

  if (await exists(DEST)) {
    console.log(`Removed the recap skill files from ${DEST}.`);
    console.log("Kept the directory: it still contains files this tool did not install.");
  } else {
    console.log(`Removed ${DEST}.`);
  }
}

async function install() {
  const { version } = await skillFrontmatter();
  const files = await sourceFiles();
  if (!files.includes("SKILL.md") || !files.includes("recap.py")) {
    fail("Package is incomplete: skills/recap must contain SKILL.md and recap.py.");
  }

  const destExists = await exists(DEST);
  const manifest = await readJson(MANIFEST);

  // Someone else's skill lives here. Never touch it.
  if (destExists && !manifest && !FORCE) {
    fail(
      `${DEST} already exists and was not installed by this tool.`,
      "Refusing to overwrite it. Move it aside, or re-run with --force.",
    );
  }

  // Our skill, but the user customized it.
  if (manifest && !FORCE) {
    const edited = await findEdits(manifest);
    if (edited.length) {
      fail(
        "You have local edits to the installed skill:",
        ...edited.map((f) => `  ${f}`),
        "Refusing to clobber them. Back them up, then re-run with --force.",
      );
    }
  }

  // Drop only what we installed last time, so an update removes files that no
  // longer ship without deleting anything the user added.
  if (manifest) await removeTracked(manifest);

  const recorded = {};
  for (const rel of files) {
    const from = path.join(SRC, rel);
    const to = path.join(DEST, rel);
    await fs.mkdir(path.dirname(to), { recursive: true });
    const buf = await fs.readFile(from);
    await fs.writeFile(to, buf);
    recorded[rel] = sha256(buf);
  }
  await fs.chmod(path.join(DEST, "recap.py"), 0o755).catch(() => {});

  await fs.writeFile(
    MANIFEST,
    `${JSON.stringify(
      {
        tool: "claude-code-recap",
        version,
        installedAt: new Date().toISOString(),
        files: recorded,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\nInstalled the recap skill (v${version}).`);
  for (const rel of files) console.log(`  ${path.join(DEST, rel)}`);
  console.log(`\nClaude Code picks up ${CONFIG_DIR}/skills without a restart.`);
  console.log("Restart it only if that directory did not exist when the session started.");
  console.log("\nRun it with:  /recap");
  console.log(`Or directly:  python3 ${path.join(DEST, "recap.py")}`);
  console.log("Uninstall:    npx claude-code-recap --uninstall");
}

async function main() {
  if (has("--help", "-h")) {
    console.log(HELP);
    return;
  }
  if (has("--version", "-v")) {
    console.log(await pkgVersion());
    return;
  }
  const known = new Set(["--force", "-f", "--uninstall", "--version", "-v", "--help", "-h"]);
  const unknown = args.filter((a) => !known.has(a));
  if (unknown.length) {
    console.error(`claude-code-recap: unknown option: ${unknown[0]}\n`);
    console.error(HELP);
    process.exit(2);
  }

  if (UNINSTALL) await uninstall();
  else await install();
}

main().catch((err) => {
  console.error(`claude-code-recap: ${err?.message ?? err}`);
  process.exit(1);
});
