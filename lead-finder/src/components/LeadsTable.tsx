"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useBusy } from "./useBusy";
import { bulkUpdate } from "@/app/actions/leads";
import { STAGES, STAGE_LABELS } from "@/lib/constants";
import { Flag, StageBadge, TierBadge } from "./ui";

export type LeadRow = {
  id: string; name: string; trade: string; city: string | null; county: string | null; tier: string; score: number; stage: string;
  phone: string; email: string | null; owner: string | null; lastContacted: string; projects: number; doNotContact: boolean; likelyHomeowner: boolean;
};

export function LeadsTable({ rows, users }: { rows: LeadRow[]; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [op, setOp] = useState("assign");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useBusy();
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const apply = () =>
    start(async () => {
      const res = await bulkUpdate({ ids: [...selected], op, value });
      setMessage(res);
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });

  return (
    <div>
      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-sm">
          <span className="font-semibold">{selected.size} selected</span>
          <select aria-label="Bulk action" className="input mt-0 w-auto" value={op} onChange={(e) => { setOp(e.target.value); setValue(""); }}>
            <option value="assign">Assign to</option>
            <option value="stage">Change stage to</option>
            <option value="tag">Add tag</option>
          </select>
          {op === "assign" ? (
            <select aria-label="Owner" className="input mt-0 w-auto" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Nobody</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : op === "stage" ? (
            <select aria-label="Stage" className="input mt-0 w-auto" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Choose…</option>
              {STAGES.filter((s) => s !== "LOST").map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          ) : (
            <input aria-label="Tag" className="input mt-0 w-40" maxLength={30} placeholder="Tag name" value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          <button type="button" className="btn btn-sm" disabled={pending} onClick={apply}>{pending ? "Working…" : "Apply to selected"}</button>
          <a className="btn-secondary btn-sm" href={`/api/export?ids=${[...selected].join(",")}`}>Export selected</a>
          <button type="button" className="text-navy-600 hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      ) : null}
      {message.error ? <p role="alert" className="mb-2 text-sm font-medium">⚠ {message.error}</p> : null}
      {message.ok ? <p role="status" className="mb-2 text-sm font-medium text-navy-600">✓ {message.ok}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-navy-100">
        <table className="table">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
              </th>
              <th>Company</th>
              <th>Score</th>
              <th>Stage</th>
              <th className="hidden md:table-cell">Location</th>
              <th className="hidden lg:table-cell">Contact</th>
              <th className="hidden lg:table-cell">Jobs</th>
              <th className="hidden md:table-cell">Last contact</th>
              <th className="hidden lg:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-navy-50" : undefined}>
                <td><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td>
                  <Link href={`/leads/${r.id}`} className="font-medium text-navy-900">{r.name}</Link>
                  <div className="muted">{r.trade}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.doNotContact ? <Flag>Do not contact</Flag> : null}
                    {r.likelyHomeowner ? <Flag>Homeowner?</Flag> : null}
                  </div>
                </td>
                <td><TierBadge tier={r.tier} score={r.score} /></td>
                <td><StageBadge stage={r.stage} /></td>
                <td className="hidden md:table-cell">{r.city ?? "—"}<div className="muted">{r.county ?? ""}</div></td>
                <td className="hidden lg:table-cell">{r.phone || <span className="muted">No phone</span>}<div className="muted max-w-[14rem] truncate">{r.email ?? "No email"}</div></td>
                <td className="hidden lg:table-cell">{r.projects}</td>
                <td className="hidden whitespace-nowrap md:table-cell">{r.lastContacted}</td>
                <td className="hidden lg:table-cell">{r.owner ?? <span className="muted">Unassigned</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
