import Link from "next/link";
import { completeTask } from "@/app/actions/leads";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, PageHeader, TierBadge, StageBadge, daysSince, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/normalize";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const staleCutoff = new Date(Date.now() - 14 * 86_400_000);
  const visible = { likelyHomeowner: false, doNotContact: false };

  const [hot, hotCount, tasks, stale, staleCount, totals, newThisWeek] = await Promise.all([
    db.company.findMany({
      where: { ...visible, tier: "Hot", stage: "NEW" },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: { projects: { orderBy: { issueDate: "desc" }, take: 1 }, contacts: { take: 1 } },
    }),
    db.company.count({ where: { ...visible, tier: "Hot", stage: "NEW" } }),
    db.task.findMany({ where: { assigneeId: user.id, completedAt: null, dueDate: { lte: endOfToday } }, orderBy: { dueDate: "asc" }, take: 20, include: { company: { select: { id: true, name: true, phone: true } } } }),
    db.company.findMany({
      where: { ...visible, stage: { in: ["CONTACTED", "CONVERSATION", "QUOTE_SENT"] }, OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: staleCutoff } }] },
      orderBy: [{ score: "desc" }],
      take: 10,
    }),
    db.company.count({ where: { ...visible, stage: { in: ["CONTACTED", "CONVERSATION", "QUOTE_SENT"] }, OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: staleCutoff } }] } }),
    db.company.groupBy({ by: ["tier"], where: { ...visible, stage: { notIn: ["WON", "LOST"] } }, _count: true }),
    db.company.count({ where: { ...visible, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
  ]);
  const tierCount = (t: string) => totals.find((x) => x.tier === t)?._count ?? 0;

  return (
    <>
      <PageHeader title={`Good ${new Date().getHours() < 12 ? "morning" : "day"}, ${user.name.split(" ")[0]}`} subtitle="Who to call today, and what is due.">
        <Link href="/leads/new" className="btn">+ Quick add lead</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Hot leads open", value: tierCount("Hot"), href: "/leads?tier=Hot" },
          { label: "Warm leads open", value: tierCount("Warm"), href: "/leads?tier=Warm" },
          { label: "Tasks due", value: tasks.length, href: "/tasks" },
          { label: "New this week", value: newThisWeek, href: "/leads?sort=newest" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card no-underline hover:border-navy-400 hover:no-underline">
            <p className="text-3xl font-semibold text-navy-900">{s.value}</p>
            <p className="muted">{s.label}</p>
          </Link>
        ))}
      </div>

      <section className="mt-7">
        <div className="mb-2 flex items-baseline justify-between">
          <h2>New hot leads</h2>
          {hotCount > hot.length ? <Link href="/leads?tier=Hot&stage=NEW" className="text-sm">See all {hotCount}</Link> : null}
        </div>
        {hot.length === 0 ? (
          <Empty title="No new hot leads right now">Import a file or check the Warm list for the next best prospects.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {hot.map((c) => {
              const p = c.projects[0];
              const top = ((c.scoreBreakdown as { label: string; points: number; detail: string }[] | null) ?? []).slice().sort((a, b) => b.points - a.points).slice(0, 2);
              return (
                <li key={c.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/leads/${c.id}`} className="font-semibold text-navy-900">{c.name}</Link>
                    <TierBadge tier={c.tier} score={c.score} />
                  </div>
                  <p className="muted">{c.trade} · {c.city ?? "Unknown city"}</p>
                  {p ? <p className="mt-1 text-sm">Latest job: {p.type} in {p.city ?? "—"}, issued {fmtDate(p.issueDate)}</p> : null}
                  <p className="muted mt-1">Why: {top.map((t) => t.detail).join(" · ") || "—"}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {c.phone ? <a href={`tel:+1${c.phone}`}>{formatPhone(c.phone)}</a> : <span className="muted">No phone</span>}
                    {c.contacts[0] ? <span className="muted">{c.contacts[0].name}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-7 grid gap-7 lg:grid-cols-2">
        <div>
          <h2 className="mb-2">Your tasks due</h2>
          {tasks.length === 0 ? (
            <Empty title="Nothing due">You are caught up.</Empty>
          ) : (
            <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="muted truncate">
                      <Link href={`/leads/${t.company.id}`}>{t.company.name}</Link> · due {fmtDate(t.dueDate)}
                      {t.dueDate < new Date(Date.now() - 86_400_000) ? " · overdue" : ""}
                    </p>
                  </div>
                  <ActionForm action={completeTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <SubmitButton className="btn-secondary btn-sm" pendingText="…">Done</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2>No contact in 14 days</h2>
            {staleCount > stale.length ? <Link href="/leads?contacted=14" className="text-sm">See all {staleCount}</Link> : null}
          </div>
          {stale.length === 0 ? (
            <Empty title="No leads going cold">Every active lead was contacted in the last two weeks.</Empty>
          ) : (
            <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100">
              {stale.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/leads/${c.id}`} className="block truncate text-sm font-medium">{c.name}</Link>
                    <p className="muted">Last contact: {daysSince(c.lastContactedAt)}</p>
                  </div>
                  <StageBadge stage={c.stage} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
