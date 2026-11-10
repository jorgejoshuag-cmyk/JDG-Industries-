import Link from "next/link";
import { scanPermits } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, Flag, PageHeader, Pagination, TierBadge, fmtDate, fmtDateTime, fmtMoney } from "@/components/ui";
import { COUNTIES, PAGE_SIZE, PROJECT_TYPES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/normalize";
import { requireUser } from "@/lib/session";
import { SOURCE_LABELS } from "@/lib/sources";
import { PERMIT_SOURCE_KEYS } from "@/lib/sources/config";

export const metadata = { title: "New permits" };
export const maxDuration = 300;

const DAY_OPTIONS = ["7", "14", "30", "60", "90"];

export default async function PermitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const one = (k: string) => String(Array.isArray(sp[k]) ? sp[k]?.[0] : (sp[k] ?? "")).trim().slice(0, 60);
  const days = DAY_OPTIONS.includes(one("days")) ? one("days") : "30";
  const county = (COUNTIES as readonly string[]).includes(one("county")) ? one("county") : "";
  const type = (PROJECT_TYPES as readonly string[]).includes(one("type")) ? one("type") : "";
  const minValue = Math.max(0, Number(one("min")) || 0);
  const hasPhone = one("phone") === "1";
  const page = Math.max(1, parseInt(one("page") || "1", 10) || 1);

  const where = {
    issueDate: { gte: new Date(Date.now() - Number(days) * 86_400_000) },
    ...(county ? { county } : {}),
    ...(type ? { type } : {}),
    ...(minValue ? { declaredValue: { gte: minValue } } : {}),
    // Businesses only: owner-builder and homeowner records never show here.
    company: { is: { likelyHomeowner: false, ...(hasPhone ? { phone: { not: null } } : {}) } },
  };

  const [total, permits, byType, lastRuns] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { declaredValue: { sort: "desc", nulls: "last" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { id: true, name: true, trade: true, tier: true, score: true, phone: true, stage: true, doNotContact: true, _count: { select: { projects: true } } } } },
    }),
    db.project.groupBy({ by: ["type"], where, _count: true, orderBy: { _count: { type: "desc" } } }),
    db.sourceRun.findMany({ where: { sourceKey: { in: PERMIT_SOURCE_KEYS } }, orderBy: { startedAt: "desc" }, take: 1 }),
  ]);
  const params: Record<string, string> = { days, ...(county ? { county } : {}), ...(type ? { type } : {}), ...(minValue ? { min: String(minValue) } : {}), ...(hasPhone ? { phone: "1" } : {}) };

  return (
    <>
      <PageHeader title="New permits" subtitle="Recently issued permits in Miami-Dade and Broward for work that needs concrete, base rock or fill — and the contractor on each one.">
        <ActionForm action={scanPermits}>
          <SubmitButton pendingText="Scanning… this can take a minute">Scan for new permits</SubmitButton>
        </ActionForm>
      </PageHeader>

      <p className="muted mb-4">
        {lastRuns[0] ? `Last scan ${fmtDateTime(lastRuns[0].startedAt)}. ` : "No scan has run yet. "}
        Scans also run automatically once a day. Coverage today: Miami-Dade County permits and City of Miami permits. No Broward city currently publishes a live permit feed — see <Link href="/import">Import</Link> for loading a permit export.
      </p>

      <form method="get" className="card mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <div><label htmlFor="days">Issued in the last</label><select id="days" name="days" defaultValue={days} className="input">{DAY_OPTIONS.map((d) => <option key={d} value={d}>{d} days</option>)}</select></div>
        <div><label htmlFor="county">Jobsite county</label><select id="county" name="county" defaultValue={county} className="input"><option value="">Both</option>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label htmlFor="type">Type of work</label><select id="type" name="type" defaultValue={type} className="input"><option value="">Any</option>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label htmlFor="min">Job value at least ($)</label><input id="min" name="min" inputMode="numeric" defaultValue={minValue || ""} className="input" /></div>
        <label className="flex items-end gap-1.5 pb-2 text-sm font-normal"><input type="checkbox" name="phone" value="1" defaultChecked={hasPhone} /> Has phone</label>
        <div className="flex items-end"><button type="submit" className="btn w-full">Show</button></div>
      </form>

      {byType.length ? (
        <p className="mb-3 flex flex-wrap gap-2 text-sm">
          {byType.map((t) => (
            <Link key={t.type} href={`/permits?${new URLSearchParams({ ...params, type: t.type }).toString()}`} className={`rounded-full border px-2.5 py-0.5 no-underline hover:no-underline ${type === t.type ? "border-navy-800 bg-navy-800 text-white" : "border-navy-200 text-navy-800 hover:bg-navy-50"}`}>
              {t.type} <span className="opacity-70">{t._count}</span>
            </Link>
          ))}
        </p>
      ) : null}

      {permits.length === 0 ? (
        <Empty title="No permits match">
          Try a longer time span, or press “Scan for new permits”.
        </Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-navy-100">
            <table className="table">
              <thead><tr><th>Issued</th><th>Work</th><th>Jobsite</th><th>Value</th><th className="hidden lg:table-cell">Rough material</th><th>Contractor</th></tr></thead>
              <tbody>
                {permits.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{fmtDate(p.issueDate)}</td>
                    <td>
                      <span className="font-medium text-navy-900">{p.type}</span>
                      <div className="muted max-w-xs">{p.description?.slice(0, 110) ?? ""}</div>
                      <div className="muted text-xs">{SOURCE_LABELS[p.source] ?? p.source} · {p.externalId}</div>
                    </td>
                    <td>{p.address ?? "—"}<div className="muted">{[p.city, p.county].filter(Boolean).join(", ")}</div></td>
                    <td className="whitespace-nowrap">{fmtMoney(p.declaredValue)}</td>
                    <td className="hidden whitespace-nowrap lg:table-cell">{p.estTons != null ? <>≈ {Math.round(p.estTons).toLocaleString("en-US")} tons</> : <span className="muted">—</span>}</td>
                    <td>
                      {p.company ? (
                        <>
                          <a href={`/leads/${p.company.id}`} className="font-medium text-navy-900">{p.company.name}</a>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <TierBadge tier={p.company.tier} score={p.company.score} />
                            {p.company.doNotContact ? <Flag>Do not contact</Flag> : null}
                            <span className="muted">{p.company.trade}</span>
                          </div>
                          <div className="text-sm">
                            {p.company.phone && !p.company.doNotContact ? <a href={`tel:+1${p.company.phone}`}>{formatPhone(p.company.phone)}</a> : <span className="muted">{p.company.doNotContact ? "" : "No phone on the permit"}</span>}
                            {p.company._count.projects > 1 ? <span className="muted"> · {p.company._count.projects} permits on file</span> : null}
                          </div>
                        </>
                      ) : <span className="muted">Unknown</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} params={params} basePath="/permits" />
          <p className="muted mt-3">Material figures are rough estimates from the permit&apos;s square footage or declared value, not takeoffs. Source: official county and city open permit data.</p>
        </>
      )}
    </>
  );
}
