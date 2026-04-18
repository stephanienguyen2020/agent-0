import fs from "fs/promises";
import path from "path";

import ReactMarkdown from "react-markdown";

import { EditorialPageShell } from "@/components/dashboard/EditorialPageShell";

export default async function SkillMdPage() {
  const filePath = path.join(process.cwd(), "content", "skill-body.md");
  const raw = await fs.readFile(filePath, "utf8");

  return (
    <EditorialPageShell title="skill.md">
      <article
        className="max-w-[720px] text-[15px] leading-relaxed text-[color:var(--ink-2)] [&_a]:text-[color:var(--accent)] [&_a]:underline [&_code]:rounded [&_code]:border [&_code]:border-[color:var(--line)] [&_code]:bg-[color:var(--bg-2)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_h1]:mb-4 [&_h1]:font-semibold [&_h1]:text-[color:var(--ink)] [&_h1]:text-2xl [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-semibold [&_h2]:text-[color:var(--ink)] [&_h2]:text-lg [&_li]:my-1 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
      >
        <ReactMarkdown>{raw}</ReactMarkdown>
      </article>
    </EditorialPageShell>
  );
}
