import Link from "next/link";
import { resolveDuplicate } from "@/app/actions/leads";
import { ActionForm } from "@/components/ActionForm";
import { Empty, PageHeader, StageBadge, TierBadge, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/normalize";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Duplicates" };

type Side = { id: string; name: string; trade: string; phone: string | null; email: string | null; address: string | null; city: string | null; zip: string | null; licenseNumber: string | null; tier: string; score: number; stage: string; createdAt: Date; _count: { projects: number; activities: number } };

function Card({ c, label }: { c: Side; label: string }) {
  return (
    <div className="rounded-lg border border-navy-100 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">{label}</p>
      <Link href={`/leads/${c.id}`} className="font-semibold text-navy-900">{c.name}</Link>
      <div className="mt-1 flex gap-2"><TierBadge tier={c.tier} score={c.score} /><StageBadge stage={c.stage} /></div>
      <dl className="mt-2 space-y-0.5 text-sm">
        <div><dt className="muted inline">Trade: </dt><dd className="inline">{c.trade}</dd></div>
        <div><dt className="muted inline">Phone: </dt><dd className="inline">{formatPhone(c.phone) || "—"}</dd></div>
        <div><dt className="muted inline">Email: </dt><dd className="inline break-all">{c.email ?? "—"}</dd></div>
        <div><dt className="muted inline">Address: </dt><dd className="inline">{[c.address, c.city, c.zip].filter(Boolean).join(", ") || "—"}</dd></div>
        <div><dt className="muted inline">License: </dt><dd className="inline">{c.licenseNumber ?? "—"}</dd></div>
        <div><dt className="muted inline">History: </dt><dd className="inline">{c._count.projects} projects, {c._count.activities} activities, added {fmtDate(c.createdAt)}</dd></div>
      </dl>
    </div>
  );
}

export default async function DuplicatesPage() {
  await requireUser();
  const include = { _count: { select: { projects: true, activities: true } } };
  const [pairs, total] = await Promise.all([
    db.duplicateCandidate.findMany({ where: { status: "PENDING" }, orderBy: [{ confidence: "desc" }, { createdAt: "asc" }], take: 20, include: { companyA: { include }, companyB: { include } } }),
    db.duplicateCandidate.count({ where: { status: "PENDING" } }),
  ]);
  return (
    <>
      <PageHeader title="Possible duplicates" subtitle="These look alike but we were not sure enough to merge them automatically. Merging keeps all contacts, projects and history." />
      {pairs.length === 0 ? (
        <Empty title="Nothing to review">Clear matches are merged automatically. Uncertain ones show up here.</Empty>
      ) : (
        <ul className="space-y-4">
          {pairs.map((p) => (
            <li key={p.id} className="card">
              <p className="mb-3 text-sm"><strong>{p.reason}</strong> <span className="muted">· {Math.round(p.confidence * 100)}% confidence</span></p>
              <div className="grid gap-3 md:grid-cols-2">
                <Card c={p.companyA} label="Lead A" />
                <Card c={p.companyB} label="Lead B" />
              </div>
              <ActionForm action={resolveDuplicate} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" name="decision" value="keepA" className="btn btn-sm">Same company — merge into A</button>
                <button type="submit" name="decision" value="keepB" className="btn btn-sm">Same company — merge into B</button>
                <SubmitButtonDismiss />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      {total > pairs.length ? <p className="muted mt-4">Showing 20 of {total}. More appear as you work through these.</p> : null}
    </>
  );
}

function SubmitButtonDismiss() {
  return <button type="submit" name="decision" value="dismiss" className="btn-secondary btn-sm">Different companies — keep both</button>;
}
