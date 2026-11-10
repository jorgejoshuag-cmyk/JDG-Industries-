import Link from "next/link";
import { PipelineBoard, type BoardCard } from "@/components/PipelineBoard";
import { Empty, PageHeader } from "@/components/ui";
import { STAGES } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Pipeline" };

const PER_COLUMN = 30;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string }> }) {
  const user = await requireUser();
  const { owner } = await searchParams;
  const where = { likelyHomeowner: false, ...(owner === "me" ? { ownerId: user.id } : {}) };

  const [groups, ...columns] = await Promise.all([
    db.company.groupBy({ by: ["stage"], where, _count: true }),
    ...STAGES.map((stage) =>
      db.company.findMany({
        where: { ...where, stage },
        orderBy: stage === "WON" || stage === "LOST" ? [{ updatedAt: "desc" }] : [{ score: "desc" }, { name: "asc" }],
        take: PER_COLUMN,
        select: { id: true, name: true, trade: true, city: true, tier: true, score: true, stage: true, owner: { select: { name: true } } },
      }),
    ),
  ]);
  const counts = Object.fromEntries(groups.map((g) => [g.stage, g._count]));
  const cards: BoardCard[] = columns.flat().map((c) => ({ ...c, owner: c.owner?.name ?? null }));

  return (
    <>
      <PageHeader title="Pipeline" subtitle={`Drag a lead to change its stage, or use the menu on each card. Showing the top ${PER_COLUMN} per stage.`}>
        <Link href={owner === "me" ? "/pipeline" : "/pipeline?owner=me"} className="btn-secondary">{owner === "me" ? "Show everyone's leads" : "Show only my leads"}</Link>
      </PageHeader>
      {cards.length === 0 ? <Empty title="No leads in the pipeline">Import a file or add a lead to get started.</Empty> : <PipelineBoard cards={cards} counts={counts} />}
    </>
  );
}
