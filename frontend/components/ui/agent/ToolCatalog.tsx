"use client";

import { useTranslations } from "next-intl";
import type { AgentTool } from "@/lib/api/client";
import { permissionTone } from "@/lib/agent/format";
import { Chip } from "./Chip";

/**
 * The tool catalogue — what the planner is allowed to pick from. Showing it keeps the
 * permission model honest: the user can see, before running anything, exactly which
 * tools are read-only and which will stop for confirmation.
 */
export function ToolCatalog({ tools }: { tools: AgentTool[] }) {
  const t = useTranslations("Agent");

  if (tools.length === 0) {
    return <p className="mt-3 text-xs text-text-3">{t("noTools")}</p>;
  }

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {tools.map((tool) => {
        const params = Object.keys(tool.parameters);
        return (
          <li key={tool.name} className="rounded-card border border-line bg-bg-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-text-1">{tool.name}</span>
              <Chip tone={permissionTone(tool.permission)} label={tool.permission} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-3">
              {/* The backend description is English-only documentation text; when the
                  catalogue carries a translation, the interface language wins. */}
              {t.has(`toolDesc.${tool.name}`) ? t(`toolDesc.${tool.name}`) : tool.description}
            </p>
            {params.length > 0 && (
              <p className="mt-2 font-mono text-[11px] text-text-3">
                {params
                  .map((p) => (tool.required.includes(p) ? `${p}*` : p))
                  .join(", ")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
