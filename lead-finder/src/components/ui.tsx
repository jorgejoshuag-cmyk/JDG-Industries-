import Link from "next/link";
import { STAGE_LABELS, type StageKey } from "@/lib/constants";

export function TierBadge({ tier, score }: { tier: string; score?: number }) {
  const cls =
    tier === "Hot" ? "bg-navy-800 text-white border-navy-800" : tier === "Warm" ? "bg-navy-100 text-navy-900 border-navy-200" : "bg-white text-neutral-600 border-neutral-300";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {tier}
      {score != null ? <span className="font-normal opacity-80">{score}</span> : null}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return <span className="inline-block whitespace-nowrap rounded border border-navy-200 bg-white px-1.5 py-0.5 text-xs text-navy-800">{STAGE_LABELS[stage as StageKey] ?? stage}</span>;
}

export function Flag({ children }: { children: React.ReactNode }) {
  return <span className="inline-block whitespace-nowrap rounded border border-black bg-black px-1.5 py-0.5 text-xs font-semibold text-white">{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-navy-200 px-4 py-8 text-center">
      <p className="font-medium text-navy-900">{title}</p>
      {children ? <div className="muted mt-1">{children}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted mt-1">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Pagination({ page, pageCount, total, params, basePath }: { page: number; pageCount: number; total: number; params: Record<string, string>; basePath: string }) {
  const href = (p: number) => `${basePath}?${new URLSearchParams({ ...params, page: String(p) }).toString()}`;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <span className="muted">
        {total.toLocaleString("en-US")} result{total === 1 ? "" : "s"} · page {page} of {Math.max(1, pageCount)}
      </span>
      <span className="flex gap-2">
        {page > 1 ? <Link className="btn-secondary btn-sm" href={href(page - 1)}>← Previous</Link> : null}
        {page < pageCount ? <Link className="btn-secondary btn-sm" href={href(page + 1)}>Next →</Link> : null}
      </span>
    </nav>
  );
}

export const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
export const fmtDateTime = (d: Date | null | undefined) => (d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
export const fmtMoney = (n: number | null | undefined) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
export function daysSince(d: Date | null | undefined): string {
  if (!d) return "Never";
  const n = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return n <= 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`;
}
