import { Empty, PageHeader, fmtMoney } from "@/components/ui";
import { ACTIVITY_LABELS, STAGES, STAGE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { SOURCE_LABELS } from "@/lib/sources";

export const metadata = { title: "Reports" };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

function Bar({ value, max }: { value: number; max: number }) {
  return <div className="h-2 min-w-[4rem] rounded bg-navy-100" aria-hidden="true"><div className="h-2 rounded bg-navy-700" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>;
}

export default async function ReportsPage() {
  await requireUser();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const base = { likelyHomeowner: false };

  const [bySource, byStage, byTrade, byCounty, activity, users, money] = await Promise.all([
    db.$queryRaw<{ source: string; leads: bigint; won: bigint; lost: bigint; won_value: number | null }[]>`
      SELECT s AS source, COUNT(*) AS leads,
             COUNT(*) FILTER (WHERE stage = 'WON') AS won,
             COUNT(*) FILTER (WHERE stage = 'LOST') AS lost,
             SUM("wonValue") FILTER (WHERE stage = 'WON') AS won_value
      FROM "Company", unnest(sources) AS s
      WHERE "likelyHomeowner" = false
      GROUP BY s ORDER BY leads DESC`,
    db.company.groupBy({ by: ["stage"], where: base, _count: true }),
    db.company.groupBy({ by: ["trade", "stage"], where: { ...base, stage: { in: ["WON", "LOST"] } }, _count: true }),
    db.company.groupBy({ by: ["county", "stage"], where: { ...base, stage: { in: ["WON", "LOST"] } }, _count: true }),
    db.activity.groupBy({ by: ["userId", "type"], where: { createdAt: { gte: since } }, _count: true }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.company.aggregate({ where: base, _sum: { quoteValue: true, wonValue: true } }),
  ]);

  const total = byStage.reduce((s, g) => s + g._count, 0);
  if (!total) return (<><PageHeader title="Reports" /><Empty title="No data yet">Reports fill in once you have leads.</Empty></>);

  const stageCount = (s: string) => byStage.find((g) => g.stage === s)?._count ?? 0;
  // "Reached" a stage = currently at that stage or further along. Lost leads count only as Lost.
  const reached = STAGES.filter((s) => s !== "LOST").map((s, i, arr) => ({ stage: s, count: arr.slice(i).reduce((sum, x) => sum + stageCount(x), 0) }));
  const winRate = (rows: { stage: string; _count: number }[]) => {
    const won = rows.filter((r) => r.stage === "WON").reduce((s, r) => s + r._count, 0);
    const lost = rows.filter((r) => r.stage === "LOST").reduce((s, r) => s + r._count, 0);
    return { won, lost };
  };
  const group = <T extends { stage: string; _count: number }>(rows: T[], key: (r: T) => string) => {
    const names = [...new Set(rows.map(key))];
    return names.map((n) => ({ name: n, ...winRate(rows.filter((r) => key(r) === n)) })).sort((a, b) => b.won + b.lost - (a.won + a.lost));
  };
  const tradeRows = group(byTrade, (r) => r.trade);
  const countyRows = group(byCounty, (r) => r.county ?? "Unknown");
  const userName = (id: string | null) => users.find((u) => u.id === id)?.name ?? "System";
  const activityUsers = [...new Set(activity.map((a) => a.userId))];
  const types = Object.keys(ACTIVITY_LABELS) as (keyof typeof ACTIVITY_LABELS)[];
  const maxSource = Math.max(...bySource.map((s) => Number(s.leads)), 1);
  const quoted = money._sum.quoteValue ?? 0;
  const won = money._sum.wonValue ?? 0;

  return (
    <>
      <PageHeader title="Reports" subtitle="Business leads only. Private homeowner records are left out." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total leads", value: total.toLocaleString("en-US") },
          { label: "Quoted value", value: fmtMoney(quoted) },
          { label: "Won value", value: fmtMoney(won) },
          { label: "Win rate (won ÷ closed)", value: pct(stageCount("WON"), stageCount("WON") + stageCount("LOST")) },
        ].map((s) => (
          <div key={s.label} className="card"><p className="text-2xl font-semibold text-navy-900">{s.value}</p><p className="muted">{s.label}</p></div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3">Conversion by stage</h2>
          <table className="table">
            <thead><tr><th>Reached stage</th><th>Leads</th><th>Of all leads</th><th className="w-1/3" /></tr></thead>
            <tbody>
              {reached.map((r) => (
                <tr key={r.stage}><td>{STAGE_LABELS[r.stage]}</td><td>{r.count}</td><td>{pct(r.count, total)}</td><td><Bar value={r.count} max={total} /></td></tr>
              ))}
              <tr><td>Lost</td><td>{stageCount("LOST")}</td><td>{pct(stageCount("LOST"), total)}</td><td><Bar value={stageCount("LOST")} max={total} /></td></tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-3">Leads and wins by source</h2>
          <table className="table">
            <thead><tr><th>Source</th><th>Leads</th><th>Won</th><th>Won value</th><th className="w-1/4" /></tr></thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.source}><td>{SOURCE_LABELS[s.source] ?? s.source}</td><td>{Number(s.leads)}</td><td>{Number(s.won)}</td><td>{fmtMoney(s.won_value)}</td><td><Bar value={Number(s.leads)} max={maxSource} /></td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted mt-2">A lead found by two sources is counted under both. Compare won value with what each source costs you to judge its return.</p>
        </section>

        <section className="card">
          <h2 className="mb-3">Win rate by trade</h2>
          {tradeRows.length === 0 ? <p className="muted">No won or lost leads yet.</p> : (
            <table className="table">
              <thead><tr><th>Trade</th><th>Won</th><th>Lost</th><th>Win rate</th></tr></thead>
              <tbody>{tradeRows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.won}</td><td>{r.lost}</td><td>{pct(r.won, r.won + r.lost)}</td></tr>)}</tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3">Win rate by county</h2>
          {countyRows.length === 0 ? <p className="muted">No won or lost leads yet.</p> : (
            <table className="table">
              <thead><tr><th>County</th><th>Won</th><th>Lost</th><th>Win rate</th></tr></thead>
              <tbody>{countyRows.map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.won}</td><td>{r.lost}</td><td>{pct(r.won, r.won + r.lost)}</td></tr>)}</tbody>
            </table>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-3">Activity per user, last 30 days</h2>
          {activityUsers.length === 0 ? <p className="muted">No activity logged in the last 30 days.</p> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>User</th>{types.map((t) => <th key={t}>{ACTIVITY_LABELS[t]}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {activityUsers.map((u) => {
                    const row = activity.filter((a) => a.userId === u);
                    return (
                      <tr key={u ?? "system"}>
                        <td>{userName(u)}</td>
                        {types.map((t) => <td key={t}>{row.find((a) => a.type === t)?._count ?? 0}</td>)}
                        <td className="font-semibold">{row.reduce((s, a) => s + a._count, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
