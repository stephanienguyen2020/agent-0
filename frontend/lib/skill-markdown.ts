import fs from "fs";
import path from "path";

/** Bump when the skill.md schema or required fields change (orthogonal to npm package version). */
export const SKILL_CONTRACT_VERSION = "1.2.0";

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export function homepageUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return trimSlash(explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${trimSlash(vercel)}`;
  return "http://localhost:3000";
}

export function apiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000";
  return trimSlash(raw);
}

export function apiHostname(apiBase: string): string {
  try {
    return new URL(apiBase.startsWith("http") ? apiBase : `http://${apiBase}`)
      .host;
  } catch {
    return apiBase;
  }
}

/** Resolve bundled skill body for both `next dev` cwd (`frontend/`) and monorepo root layouts. */
export function resolveSkillBodyPathSync(): string | null {
  const candidates = [
    path.join(process.cwd(), "content", "skill-body.md"),
    path.join(process.cwd(), "frontend", "content", "skill-body.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Substitute `{{API_BASE}}`, `{{SITE_URL}}`, `{{OPENAPI_DOCS_URL}}` for agents and the in-app skill page. */
export function applySkillPlaceholders(markdown: string): string {
  const apiBase = apiBaseUrl();
  const site = homepageUrl();
  const openApi = `${apiBase}/docs`;
  return markdown
    .replace(/\{\{API_BASE\}\}/g, apiBase)
    .replace(/\{\{SITE_URL\}\}/g, site)
    .replace(/\{\{OPENAPI_DOCS_URL\}\}/g, openApi);
}
