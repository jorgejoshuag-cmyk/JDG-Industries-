import Link from "next/link";
import { Empty, PageHeader, Pagination, fmtDateTime } from "@/components/ui";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { SOURCE_LABELS } from "@/lib/sources";

export const metadata = { title: "Logs" };

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view = sp.view === "audit" ? "audit" : "runs";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [runs, runTotal, logs, logTotal] = await Promise.all([
    view === "runs" ? db.sourceRun.findMany({ orderBy: { startedAt: "desc" }, skip, take: PAGE_SIZE }) : [],
    view === "runs" ? db.sourceRun.count() : 0,
    view === "audit" ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, include: { user: { select: { name: true } } } }) : [],
    view === "audit" ? db.auditLog.count() : 0,
  ]);
  const total = view === "runs" ? runTotal : logTotal;

  return (
    <>
      <PageHeader title="Logs" subtitle="Source runs and a record of who changed what.">
        <Link href="/admin/logs?view=runs" className={view === "runs" ? "btn btn-sm" : "btn-secondary btn-sm"}>Source runs</Link>
        <Link href="/admin/logs?view=audit" className={view === "audit" ? "btn btn-sm" : "btn-secondary btn-sm"}>Audit log</Link>
      </PageHeader>
      {total === 0 ? (
        <Empty title={view === "runs" ? "No source runs yet" : "No audit entries yet"}>{view === "runs" ? "Runs appear here once a source is set up under Admin → Sources." : "Entries appear as people use the tool."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-navy-100">
          {view === "runs" ? (
            <table className="table">
              <thead><tr><th>Started</th><th>Source</th><th>Status</th><th>Found</th><th>Added</th><th>Updated</th><th>Errors</th><th>Finished</th><th>Message</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(r.startedAt)}</td><td>{SOURCE_LABELS[r.sourceKey] ?? r.sourceKey}</td>
                    <td className={r.status === "failed" ? "font-semibold" : ""}>{r.status}</td>
                    <td>{r.found}</td><td>{r.added}</td><td>{r.updated}</td><td>{r.errorCount}</td>
                    <td className="whitespace-nowrap">{fmtDateTime(r.finishedAt)}</td><td className="max-w-xs break-words">{r.message ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(l.createdAt)}</td><td>{l.user?.name ?? "System"}</td><td><code>{l.action}</code></td>
                    <td>{l.entity === "Company" && l.entityId ? <a href={`/leads/${l.entityId}`}>Lead</a> : l.entity}</td>
                    <td className="max-w-md break-words font-mono text-xs">{l.detail ? JSON.stringify(l.detail).slice(0, 300) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} params={{ view }} basePath="/admin/logs" />
    </>
  );
}
