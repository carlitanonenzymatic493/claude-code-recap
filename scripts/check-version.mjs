#!/usr/bin/env node
// Fails unless package.json, .claude-plugin/plugin.json, skills/recap/SKILL.md
// (metadata.version) and the pushed git tag all state the same version.
// Run in CI before publishing.

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => fs.readFile(path.join(ROOT, ...p), "utf8");

const pkg = JSON.parse(await read("package.json"));
const plugin = JSON.parse(await read(".claude-plugin", "plugin.json"));
const md = await read("skills", "recap", "SKILL.md");

const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!fm) {
  console.error("skills/recap/SKILL.md has no YAML frontmatter.");
  process.exit(1);
}

// The Agent Skills spec has no top-level `version`; it lives under `metadata`.
const skillVersion = fm[1]
  .match(/^metadata:\r?\n(?:[ \t]+.*\r?\n?)*/m)?.[0]
  ?.match(/^[ \t]+version:\s*["']?([^"'\s]+)["']?/m)?.[1];

if (!skillVersion) {
  console.error("skills/recap/SKILL.md frontmatter is missing metadata.version.");
  process.exit(1);
}

const errors = [];
if (skillVersion !== pkg.version) {
  errors.push(`SKILL.md metadata.version (${skillVersion}) != package.json version (${pkg.version})`);
}
if (plugin.version !== pkg.version) {
  errors.push(`plugin.json version (${plugin.version}) != package.json version (${pkg.version})`);
}

const tag = process.env.GITHUB_REF_NAME;
if (tag?.startsWith("v") && tag.slice(1) !== pkg.version) {
  errors.push(`git tag ${tag} != package.json version (${pkg.version})`);
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error("\nBump all of them together, then retag.");
  process.exit(1);
}

console.log(`Version sync OK: ${pkg.version}`);
