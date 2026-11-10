import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { STAGE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { filterContactable } from "@/lib/dnc";
import { buildLeadWhere, leadOrderBy, parseLeadFilters } from "@/lib/lead-query";
import { formatPhone } from "@/lib/normalize";
import { loadSuppressionSet } from "@/lib/suppression";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

/** Quote a CSV cell, and neutralise spreadsheet formulas (cells starting with = + - @). */
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const user = userId ? await db.user.findUnique({ where: { id: userId } }) : null;
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 500);
  const { filters } = parseLeadFilters(params);
  const where = ids.length ? { id: { in: ids } } : buildLeadWhere(filters, user.id);

  const rows = await db.company.findMany({
    where,
    orderBy: leadOrderBy(filters.sort),
    take: MAX_ROWS,
    include: { owner: { select: { name: true } }, contacts: { take: 1, orderBy: { createdAt: "asc" } }, _count: { select: { projects: true } } },
  });
  // Do-not-contact, opted-out and homeowner records never leave the system in an export.
  const allowed = filterContactable(rows, await loadSuppressionSet());

  const header = ["Company", "Trade", "Tier", "Score", "Stage", "Owner", "Phone", "Email", "Website", "Contact", "Contact title", "Address", "City", "County", "ZIP", "License", "Projects", "Last contacted", "Sources", "Tags", "Source retrieved"];
  const lines = [header.map(cell).join(",")];
  for (const c of allowed) {
    lines.push(
      [
        c.name, c.trade, c.tier, c.score, STAGE_LABELS[c.stage], c.owner?.name ?? "", formatPhone(c.phone), c.email ?? "", c.website ?? "",
        c.contacts[0]?.name ?? "", c.contacts[0]?.title ?? "", c.address ?? "", c.city ?? "", c.county ?? "", c.zip ?? "", c.licenseNumber ?? "",
        c._count.projects, c.lastContactedAt?.toISOString().slice(0, 10) ?? "", c.sources.join("; "), c.tags.join("; "), c.sourceRetrievedAt.toISOString().slice(0, 10),
      ].map(cell).join(","),
    );
  }
  await audit(user.id, "export.leads", "Company", null, { exported: allowed.length, withheld: rows.length - allowed.length });

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
