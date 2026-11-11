import Link from "next/link";
import { deleteFilter, saveFilter } from "@/app/actions/leads";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { LeadsTable, type LeadRow } from "@/components/LeadsTable";
import { Empty, PageHeader, Pagination, daysSince } from "@/components/ui";
import { COUNTIES, STAGES, STAGE_LABELS, TIERS, TRADES } from "@/lib/constants";
import { db } from "@/lib/db";
import { activeParams, buildLeadWhere, leadOrderBy, PAGE_SIZE, parseLeadFilters } from "@/lib/lead-query";
import { formatPhone } from "@/lib/normalize";
import { requireUser } from "@/lib/session";
import { SOURCE_LABELS } from "@/lib/sources";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { filters: f, page } = parseLeadFilters(await searchParams);
  const where = buildLeadWhere(f, user.id);
  const params = activeParams(f);
  const query = new URLSearchParams(params).toString();

  const [total, companies, users, saved, cities] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: leadOrderBy(f.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { owner: { select: { name: true } }, _count: { select: { projects: true } } },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.savedFilter.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    db.company.findMany({ where: { city: { not: null } }, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" }, take: 200 }),
  ]);

  const rows: LeadRow[] = companies.map((c) => ({
    id: c.id, name: c.name, trade: c.trade, city: c.city, county: c.county, tier: c.tier, score: c.score, stage: c.stage,
    phone: formatPhone(c.phone), email: c.email, owner: c.owner?.name ?? null, lastContacted: daysSince(c.lastContactedAt),
    projects: c._count.projects, doNotContact: c.doNotContact, likelyHomeowner: c.likelyHomeowner,
  }));
  const filterCount = Object.keys(params).filter((k) => k !== "sort").length;
  const sel = "input mt-0";

  return (
    <>
      <PageHeader title="Leads" subtitle="Ranked by score. Private homeowners are hidden unless you ask for them.">
        <a href={`/api/export?${query}`} className="btn-secondary">Export CSV</a>
        <Link href="/leads/new" className="btn">+ Quick add</Link>
      </PageHeader>

      {saved.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="muted">Saved:</span>
          {saved.map((s) => (
            <span key={s.id} className="inline-flex items-center overflow-hidden rounded-full border border-navy-200">
              <Link href={`/leads?${s.query}`} className="px-2.5 py-0.5 text-navy-800 no-underline hover:bg-navy-50 hover:no-underline">{s.name}</Link>
              <ActionForm action={deleteFilter} className="contents">
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" aria-label={`Delete saved filter ${s.name}`} className="border-l border-navy-200 px-1.5 text-neutral-500 hover:bg-navy-50">×</button>
              </ActionForm>
            </span>
          ))}
        </div>
      ) : null}

      <details className="card mb-4" open={filterCount > 0}>
        <summary className="cursor-pointer text-sm font-semibold text-navy-900">Filters{filterCount ? ` (${filterCount} on)` : ""}</summary>
        <form method="get" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2">
            <label htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={f.q} placeholder="Company, contact, phone, license" className="input" />
          </div>
          <div><label htmlFor="tier">Tier</label><select id="tier" name="tier" defaultValue={f.tier} className={sel}><option value="">Any</option>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue={f.stage} className={sel}><option value="">Any</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select></div>
          <div><label htmlFor="trade">Trade</label><select id="trade" name="trade" defaultValue={f.trade} className={sel}><option value="">Any</option>{TRADES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label htmlFor="county">County</label><select id="county" name="county" defaultValue={f.county} className={sel}><option value="">Any</option>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="city">City</label><select id="city" name="city" defaultValue={f.city} className={sel}><option value="">Any</option>{cities.map((c) => <option key={c.city}>{c.city}</option>)}</select></div>
          <div><label htmlFor="zip">ZIP</label><input id="zip" name="zip" defaultValue={f.zip} inputMode="numeric" maxLength={5} className="input" /></div>
          <div><label htmlFor="source">Source</label><select id="source" name="source" defaultValue={f.source} className={sel}><option value="">Any</option>{Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label htmlFor="owner">Owner</label><select id="owner" name="owner" defaultValue={f.owner} className={sel}><option value="">Anyone</option><option value="me">Me</option><option value="none">Unassigned</option>{users.filter((u) => u.id !== user.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div><label htmlFor="contacted">Last contacted</label><select id="contacted" name="contacted" defaultValue={f.contacted} className={sel}><option value="">Any time</option><option value="never">Never</option><option value="7">Not in 7 days</option><option value="14">Not in 14 days</option><option value="30">Not in 30 days</option><option value="60">Not in 60 days</option></select></div>
          <div><label htmlFor="tag">Tag</label><input id="tag" name="tag" defaultValue={f.tag} maxLength={30} className="input" /></div>
          <div><label htmlFor="show">Show</label><select id="show" name="show" defaultValue={f.show} className={sel}><option value="">Business leads</option><option value="dnc">Do-not-contact only</option><option value="homeowners">Possible homeowners only</option><option value="all">Everything</option></select></div>
          <div><label htmlFor="sort">Sort by</label><select id="sort" name="sort" defaultValue={f.sort} className={sel}><option value="">Score (high first)</option><option value="name">Name</option><option value="newest">Newest</option><option value="contacted">Longest since contact</option></select></div>
          <div className="flex items-end gap-4 pb-2 text-sm">
            <label className="flex items-center gap-1.5 font-normal"><input type="checkbox" name="hasPhone" value="1" defaultChecked={f.hasPhone === "1"} /> Has phone</label>
            <label className="flex items-center gap-1.5 font-normal"><input type="checkbox" name="hasEmail" value="1" defaultChecked={f.hasEmail === "1"} /> Has email</label>
          </div>
          <div className="col-span-2 flex items-end gap-2 md:col-span-4">
            <button type="submit" className="btn">Apply filters</button>
            <Link href="/leads" className="btn-secondary">Clear</Link>
          </div>
        </form>
        {filterCount > 0 ? (
          <ActionForm action={saveFilter} resetOnSuccess className="mt-3 flex flex-wrap items-end gap-2 border-t border-navy-100 pt-3">
            <input type="hidden" name="query" value={query} />
            <div><label htmlFor="filterName">Save these filters as</label><input id="filterName" name="name" required maxLength={60} placeholder="e.g. Hot Broward pavers" className="input w-56" /></div>
            <SubmitButton className="btn-secondary">Save filter</SubmitButton>
          </ActionForm>
        ) : null}
      </details>

      {rows.length === 0 ? (
        <Empty title={filterCount ? "No leads match these filters" : "No leads yet"}>
          {filterCount ? <Link href="/leads">Clear the filters</Link> : <>Start by <Link href="/import">importing a file</Link> or <Link href="/leads/new">adding a lead</Link>.</>}
        </Empty>
      ) : (
        <>
          <LeadsTable rows={rows} users={users} />
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} params={params} basePath="/leads" />
        </>
      )}
    </>
  );
}
