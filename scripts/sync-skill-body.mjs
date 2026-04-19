#!/usr/bin/env node
/**
 * Reminder helper: `frontend/content/skill-body.md` is the bundled AI skill body for GET /skill.md.
 * It intentionally extends `docs/agent-http-integration.md` with API tables and platform notes.
 *
 * This script does not auto-merge (would overwrite hand-edited tables). After editing the doc in
 * `docs/`, manually reconcile changes into `frontend/content/skill-body.md`, then:
 *   curl -sS http://localhost:3000/skill.md | grep -c '{{'
 * should print `0` (no unresolved placeholders).
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = path.join(root, "docs", "agent-http-integration.md");
const skill = path.join(root, "frontend", "content", "skill-body.md");

console.log("Agent skill bundle:\n");
console.log("  Doc (human):     ", doc);
console.log("  Bundled (agents):", skill);
console.log("\nEdit the bundled file after changing the doc; verify placeholders with curl /skill.md.\n");
