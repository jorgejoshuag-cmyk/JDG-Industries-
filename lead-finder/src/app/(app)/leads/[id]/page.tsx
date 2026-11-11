import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addContact, addProject, addTask, clearDoNotContact, completeTask, deleteContact, deleteLead, logActivity, setDoNotContact, setHomeownerFlag, setOwner, updateLead,
} from "@/app/actions/leads";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DocumentTitle } from "@/components/DocumentTitle";
import { JobsiteMap, type MapPoint } from "@/components/JobsiteMap";
import { OutreachPanel } from "@/components/OutreachPanel";
import { StageControl } from "@/components/StageControl";
import { Empty, Flag, TierBadge, fmtDate, fmtDateTime, fmtMoney } from "@/components/ui";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, COUNTIES, OUTCOMES, PROJECT_TYPES, TRADES } from "@/lib/constants";
import { db } from "@/lib/db";
import { contactBlockReason } from "@/lib/dnc";
import { formatPhone } from "@/lib/normalize";
import type { ScoreLine } from "@/lib/scoring";
import { requireUser } from "@/lib/session";
import { getSettings, yardCoords } from "@/lib/settings";
import { SOURCE_LABELS } from "@/lib/sources";
import { loadSuppressionSet } from "@/lib/suppression";

// Static on purpose: see components/DocumentTitle.tsx.
export const metadata = { title: "Lead" };

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ merged?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { merged } = await searchParams;

  const [company, users, templates, settings, suppression] = await Promise.all([
    db.company.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        contacts: { orderBy: { createdAt: "asc" } },
        projects: { orderBy: [{ issueDate: { sort: "desc", nulls: "last" } }], take: 50 },
        activities: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
        tasks: { orderBy: [{ completedAt: { sort: "desc", nulls: "first" } }, { dueDate: "asc" }], take: 30, include: { assignee: { select: { name: true } } } },
      },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.outreachTemplate.findMany({ where: { active: true }, orderBy: [{ channel: "asc" }, { name: "asc" }], select: { id: true, name: true, channel: true } }),
    getSettings(),
    loadSuppressionSet(),
  ]);
  if (!company) notFound();

  const blocked = contactBlockReason(company, suppression);
  const breakdown = (company.scoreBreakdown as ScoreLine[] | null) ?? [];
  const yard = yardCoords(settings);
  const points: MapPoint[] = [
    ...(company.lat != null && company.lng != null ? [{ lat: company.lat, lng: company.lng, label: `${company.name} (office)`, kind: "office" as const }] : []),
    ...company.projects.filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat as number, lng: p.lng as number, label: `${p.type} — ${p.address ?? p.city ?? p.externalId}`, kind: "jobsite" as const })),
  ];
  if (points.length && yard) points.push({ lat: yard.lat, lng: yard.lng, label: "Our yard", kind: "yard" });
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const mapsQuery = encodeURIComponent([company.address, company.city, "FL", company.zip].filter(Boolean).join(", "));

  return (
    <>
      <DocumentTitle title={company.name} />
      <p className="mb-2 text-sm"><Link href="/leads">← Leads</Link></p>
      {merged ? <p role="status" className="mb-3 rounded-md border border-navy-200 bg-navy-50 px-3 py-2 text-sm">This company was already in the system, so your details were added to the existing lead.</p> : null}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{company.name}</h1>
          <p className="muted mt-1">{company.trade} · {[company.city, company.county].filter(Boolean).join(", ") || "Location unknown"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TierBadge tier={company.tier} score={company.score} />
            {company.doNotContact ? <Flag>Do not contact</Flag> : null}
            {company.likelyHomeowner ? <Flag>Possible homeowner</Flag> : null}
            {company.tags.map((t) => <Link key={t} href={`/leads?tag=${encodeURIComponent(t)}`} className="rounded-full border border-navy-200 px-2 py-0.5 text-xs text-navy-800">#{t}</Link>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {company.phone && !blocked ? <a className="btn" href={`tel:+1${company.phone}`}>Call {formatPhone(company.phone)}</a> : null}
          {mapsQuery ? <a className="btn-secondary" href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer">Directions</a> : null}
        </div>
      </div>

      {blocked ? (
        <div role="alert" className="mb-5 rounded-lg border-2 border-black bg-white px-4 py-3">
          <p className="font-semibold">Outreach is blocked for this lead</p>
          <p className="text-sm">{blocked}{company.dncReason ? ` Reason: ${company.dncReason}${company.dncAt ? ` (${fmtDate(company.dncAt)})` : ""}.` : ""}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------ left column */}
        <div className="space-y-5 lg:col-span-2">
          <section className="card">
            <h2 className="mb-3">Outreach</h2>
            {blocked ? (
              <p className="muted">Drafts are turned off for this lead.</p>
            ) : (
              <OutreachPanel
                companyId={company.id}
                templates={templates}
                contacts={company.contacts.map((c) => ({ id: c.id, name: c.name }))}
                aiEnabled={Boolean(process.env.OPENAI_API_KEY)}
                addressMissing={!settings.business_address.trim()}
              />
            )}
          </section>

          <section className="card">
            <h2 className="mb-3">Projects and jobsites</h2>
            {company.projects.length === 0 ? (
              <Empty title="No projects on file">Add a permit, bid or job you heard about.</Empty>
            ) : (
              <ul className="divide-y divide-navy-100">
                {company.projects.map((p) => (
                  <li key={p.id} className="py-3 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-navy-900">{p.type} <span className="muted font-normal">· {p.externalId}</span></p>
                      <p className="muted">{p.issueDate ? `Issued ${fmtDate(p.issueDate)}` : "No issue date"}{p.status ? ` · ${p.status}` : ""}</p>
                    </div>
                    {p.description ? <p className="text-sm">{p.description}</p> : null}
                    <p className="muted">{[p.address, p.city, p.zip].filter(Boolean).join(", ") || "No jobsite address"} · Declared value {fmtMoney(p.declaredValue)}{p.areaSqFt ? ` · ${Math.round(p.areaSqFt).toLocaleString("en-US")} sq ft` : ""}</p>
                    {p.estTons != null ? (
                      <p className="mt-1 rounded bg-navy-50 px-2 py-1 text-sm">
                        <strong>Rough material estimate:</strong> about {p.estTons.toLocaleString("en-US")} tons ({p.estCubicYards?.toLocaleString("en-US")} cu yd). {p.estNote} <span className="muted">Not a takeoff — confirm with the customer.</span>
                      </p>
                    ) : null}
                    <p className="muted mt-1">Source: {SOURCE_LABELS[p.source] ?? p.source}, retrieved {fmtDate(p.retrievedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            {points.length ? <div className="mt-4"><JobsiteMap points={points} /></div> : <p className="muted mt-3">No map: this lead has no coordinates yet. Add latitude and longitude under Edit details.</p>}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add a project</summary>
              <ActionForm action={addProject} resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="companyId" value={company.id} />
                <div><label htmlFor="p-type">Type</label><select id="p-type" name="type" className="input">{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><label htmlFor="p-ext">Permit / bid number</label><input id="p-ext" name="externalId" maxLength={80} className="input" /></div>
                <div className="sm:col-span-2"><label htmlFor="p-desc">Description</label><input id="p-desc" name="description" maxLength={1000} className="input" /></div>
                <div className="sm:col-span-2"><label htmlFor="p-addr">Jobsite address</label><input id="p-addr" name="address" maxLength={300} className="input" /></div>
                <div><label htmlFor="p-city">City</label><input id="p-city" name="city" maxLength={80} className="input" /></div>
                <div><label htmlFor="p-county">County</label><select id="p-county" name="county" className="input"><option value="">Unknown / other</option>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                <div><label htmlFor="p-value">Declared value ($)</label><input id="p-value" name="declaredValue" inputMode="decimal" maxLength={20} className="input" /></div>
                <div><label htmlFor="p-area">Area (sq ft)</label><input id="p-area" name="areaSqFt" inputMode="decimal" maxLength={20} className="input" /></div>
                <div><label htmlFor="p-date">Issue date</label><input id="p-date" name="issueDate" type="date" className="input" /></div>
                <div className="flex items-end"><SubmitButton>Add project</SubmitButton></div>
              </ActionForm>
            </details>
          </section>

          <section className="card">
            <h2 className="mb-3">Activity</h2>
            <ActionForm action={logActivity} resetOnSuccess className="grid gap-3 rounded-lg bg-navy-50 p-3 sm:grid-cols-2">
              <input type="hidden" name="companyId" value={company.id} />
              <div><label htmlFor="a-type">Type</label><select id="a-type" name="type" className="input">{ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}</select></div>
              <div><label htmlFor="a-outcome">Outcome</label><select id="a-outcome" name="outcome" className="input"><option value="">—</option>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select></div>
              <div className="sm:col-span-2"><label htmlFor="a-body">Notes</label><textarea id="a-body" name="body" rows={2} maxLength={4000} className="input" /></div>
              <div><label htmlFor="a-fu">Follow up on (optional)</label><input id="a-fu" name="followUpDate" type="date" className="input" /></div>
              <div className="flex items-end"><SubmitButton>Log activity</SubmitButton></div>
              <p className="muted sm:col-span-2">Choosing “Opted out” puts this lead on the do-not-contact list.</p>
            </ActionForm>
            {company.activities.length === 0 ? (
              <div className="mt-4"><Empty title="No activity yet">Log your first call, email or note above.</Empty></div>
            ) : (
              <ol className="mt-4 space-y-3 border-l-2 border-navy-100 pl-4">
                {company.activities.map((a) => (
                  <li key={a.id}>
                    <p className="text-sm"><strong>{ACTIVITY_LABELS[a.type]}</strong>{a.outcome ? ` · ${a.outcome}` : ""} <span className="muted">— {a.user?.name ?? "System"}, {fmtDateTime(a.createdAt)}</span></p>
                    {a.body ? <p className="whitespace-pre-wrap text-sm text-neutral-700">{a.body}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* ------------------------------------------------ right column */}
        <div className="space-y-5">
          <section className="card space-y-3">
            <h2>Pipeline</h2>
            <StageControl id={company.id} stage={company.stage} lostReason={company.lostReason} />
            <ActionForm action={setOwner} className="flex items-end gap-2">
              <input type="hidden" name="id" value={company.id} />
              <div className="flex-1"><label htmlFor="owner">Owner</label><select id="owner" name="ownerId" defaultValue={company.ownerId ?? ""} className="input"><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <SubmitButton className="btn-secondary" pendingText="…">Set</SubmitButton>
            </ActionForm>
            <p className="muted">Quote {fmtMoney(company.quoteValue)} · Won {fmtMoney(company.wonValue)} · Last contact {fmtDate(company.lastContactedAt)}</p>
          </section>

          <section className="card">
            <h2 className="mb-2">Why this score: {company.score}/100</h2>
            {breakdown.length === 0 ? <p className="muted">Not scored yet.</p> : (
              <ul className="space-y-2">
                {breakdown.map((l) => (
                  <li key={l.key}>
                    <div className="flex justify-between text-sm"><span>{l.label}</span><span className="tabular-nums">{l.points} / {l.max}</span></div>
                    <div className="h-1.5 rounded bg-navy-100" aria-hidden="true"><div className="h-1.5 rounded bg-navy-700" style={{ width: `${l.max ? (l.points / l.max) * 100 : 0}%` }} /></div>
                    <p className="muted">{l.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="mb-2">Tasks</h2>
            {company.tasks.length === 0 ? <p className="muted">No tasks.</p> : (
              <ul className="space-y-2">
                {company.tasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className={t.completedAt ? "text-neutral-500 line-through" : ""}>
                      {t.title}
                      <div className="muted no-underline">Due {fmtDate(t.dueDate)} · {t.assignee?.name ?? "Unassigned"}</div>
                    </div>
                    <ActionForm action={completeTask}>
                      <input type="hidden" name="id" value={t.id} />
                      {t.completedAt ? <input type="hidden" name="reopen" value="1" /> : null}
                      <SubmitButton className="btn-secondary btn-sm" pendingText="…">{t.completedAt ? "Reopen" : "Done"}</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addTask} resetOnSuccess className="mt-3 space-y-2 border-t border-navy-100 pt-3">
              <input type="hidden" name="companyId" value={company.id} />
              <div><label htmlFor="t-title">New task</label><input id="t-title" name="title" required maxLength={200} placeholder="Follow-up call" className="input" /></div>
              <div className="flex gap-2">
                <input aria-label="Due date" name="dueDate" type="date" required defaultValue={tomorrow} className="input mt-0" />
                <select aria-label="Assign to" name="assigneeId" defaultValue={user.id} className="input mt-0">{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
              </div>
              <SubmitButton className="btn-secondary">Add task</SubmitButton>
            </ActionForm>
          </section>

          <section className="card">
            <h2 className="mb-2">Contacts</h2>
            {company.contacts.length === 0 ? <p className="muted">No named contacts yet.</p> : (
              <ul className="space-y-3">
                {company.contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}{c.title ? <span className="muted font-normal"> · {c.title}</span> : null}</p>
                      {c.phone ? <p>{blocked ? formatPhone(c.phone) : <a href={`tel:+1${c.phone}`}>{formatPhone(c.phone)}</a>}</p> : null}
                      {c.email ? <p className="truncate">{c.email}</p> : null}
                      {c.preferredChannel ? <p className="muted">Prefers {c.preferredChannel.toLowerCase()}</p> : null}
                    </div>
                    <ActionForm action={deleteContact} confirm={`Remove ${c.name}?`}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-xs text-neutral-500 hover:underline">Remove</button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3 border-t border-navy-100 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add contact</summary>
              <ActionForm action={addContact} resetOnSuccess className="mt-2 space-y-2">
                <input type="hidden" name="companyId" value={company.id} />
                <input aria-label="Name" name="name" required maxLength={120} placeholder="Name" className="input" />
                <input aria-label="Title" name="title" maxLength={80} placeholder="Title" className="input" />
                <input aria-label="Phone" name="phone" type="tel" maxLength={40} placeholder="Phone" className="input" />
                <input aria-label="Email" name="email" type="email" maxLength={200} placeholder="Email" className="input" />
                <select aria-label="Preferred channel" name="preferredChannel" className="input"><option value="">Preferred channel…</option><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="TEXT">Text</option></select>
                <SubmitButton className="btn-secondary">Add contact</SubmitButton>
              </ActionForm>
            </details>
          </section>

          <section className="card">
            <h2 className="mb-2">Company details</h2>
            <dl className="space-y-1 text-sm">
              <div><dt className="muted inline">Phone: </dt><dd className="inline">{formatPhone(company.phone) || "—"}</dd></div>
              <div><dt className="muted inline">Email: </dt><dd className="inline break-all">{company.email ?? "—"}</dd></div>
              <div><dt className="muted inline">Website: </dt><dd className="inline break-all">{company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer nofollow">{company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : "—"}</dd></div>
              <div><dt className="muted inline">Address: </dt><dd className="inline">{[company.address, company.city, company.zip].filter(Boolean).join(", ") || "—"}</dd></div>
              <div><dt className="muted inline">License: </dt><dd className="inline">{company.licenseNumber ?? "—"}</dd></div>
              <div><dt className="muted inline">Sources: </dt><dd className="inline">{company.sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ") || "—"}</dd></div>
              <div><dt className="muted inline">Retrieved: </dt><dd className="inline">{fmtDate(company.sourceRetrievedAt)}</dd></div>
            </dl>
            <details className="mt-3 border-t border-navy-100 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-navy-800">Edit details</summary>
              <ActionForm action={updateLead} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={company.id} />
                <div><label htmlFor="e-name">Company name</label><input id="e-name" name="name" required defaultValue={company.name} maxLength={200} className="input" /></div>
                <div><label htmlFor="e-trade">Trade</label><select id="e-trade" name="trade" defaultValue={company.trade} className="input">{TRADES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><label htmlFor="e-phone">Phone</label><input id="e-phone" name="phone" type="tel" defaultValue={formatPhone(company.phone)} maxLength={40} className="input" /></div>
                <div><label htmlFor="e-email">Email</label><input id="e-email" name="email" type="email" defaultValue={company.email ?? ""} maxLength={200} className="input" /></div>
                <div><label htmlFor="e-web">Website</label><input id="e-web" name="website" defaultValue={company.website ?? ""} maxLength={300} className="input" /></div>
                <div><label htmlFor="e-addr">Address</label><input id="e-addr" name="address" defaultValue={company.address ?? ""} maxLength={300} className="input" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor="e-city">City</label><input id="e-city" name="city" defaultValue={company.city ?? ""} maxLength={80} className="input" /></div>
                  <div><label htmlFor="e-zip">ZIP</label><input id="e-zip" name="zip" defaultValue={company.zip ?? ""} maxLength={10} className="input" /></div>
                </div>
                <div><label htmlFor="e-county">County</label><input id="e-county" name="county" defaultValue={company.county ?? ""} maxLength={40} list="counties" className="input" /><datalist id="counties">{COUNTIES.map((c) => <option key={c} value={c} />)}</datalist></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor="e-lat">Latitude</label><input id="e-lat" name="lat" defaultValue={company.lat ?? ""} maxLength={20} inputMode="decimal" className="input" /></div>
                  <div><label htmlFor="e-lng">Longitude</label><input id="e-lng" name="lng" defaultValue={company.lng ?? ""} maxLength={20} inputMode="decimal" className="input" /></div>
                </div>
                <div><label htmlFor="e-lic">License number</label><input id="e-lic" name="licenseNumber" defaultValue={company.licenseNumber ?? ""} maxLength={40} className="input" /></div>
                <div><label htmlFor="e-tags">Tags (comma separated)</label><input id="e-tags" name="tags" defaultValue={company.tags.join(", ")} maxLength={300} className="input" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label htmlFor="e-quote">Quote value ($)</label><input id="e-quote" name="quoteValue" defaultValue={company.quoteValue ?? ""} maxLength={20} inputMode="decimal" className="input" /></div>
                  <div><label htmlFor="e-won">Won value ($)</label><input id="e-won" name="wonValue" defaultValue={company.wonValue ?? ""} maxLength={20} inputMode="decimal" className="input" /></div>
                </div>
                <SubmitButton>Save details</SubmitButton>
              </ActionForm>
            </details>
          </section>

          <section className="card space-y-3">
            <h2>Compliance</h2>
            {company.doNotContact ? (
              user.role === "ADMIN" ? (
                <ActionForm action={clearDoNotContact} confirm="Only do this if the lead was flagged by mistake. If they asked not to be contacted, leave it on. Remove from the do-not-contact list?">
                  <input type="hidden" name="id" value={company.id} />
                  <SubmitButton className="btn-secondary">Remove from do-not-contact (flagged by mistake)</SubmitButton>
                </ActionForm>
              ) : <p className="muted">On the do-not-contact list. Only an admin can undo this.</p>
            ) : (
              <ActionForm action={setDoNotContact} confirm="Add this lead to the do-not-contact list? Drafts and exports will be blocked.">
                <input type="hidden" name="id" value={company.id} />
                <label htmlFor="dnc-reason">Add to do-not-contact list</label>
                <div className="flex gap-2">
                  <input id="dnc-reason" name="reason" required maxLength={200} placeholder="Reason, e.g. asked us to stop" className="input mt-0" />
                  <SubmitButton className="btn-secondary" pendingText="…">Add</SubmitButton>
                </div>
              </ActionForm>
            )}
            <ActionForm action={setHomeownerFlag}>
              <input type="hidden" name="id" value={company.id} />
              <input type="hidden" name="value" value={company.likelyHomeowner ? "0" : "1"} />
              <SubmitButton className="btn-secondary btn-sm" pendingText="…">{company.likelyHomeowner ? "This is a business — clear homeowner flag" : "Flag as private homeowner"}</SubmitButton>
            </ActionForm>
            {user.role === "ADMIN" ? (
              <ActionForm action={deleteLead} confirm={`Permanently delete ${company.name} and all of its history?`}>
                <input type="hidden" name="id" value={company.id} />
                <button type="submit" className="text-xs text-neutral-500 hover:underline">Delete this lead</button>
              </ActionForm>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
