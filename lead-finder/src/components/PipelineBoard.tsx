"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { setStage } from "@/app/actions/leads";
import { LOST_REASONS, STAGES, STAGE_LABELS, type StageKey } from "@/lib/constants";
import { TierBadge } from "./ui";

export type BoardCard = { id: string; name: string; trade: string; city: string | null; tier: string; score: number; stage: StageKey; owner: string | null };

export function PipelineBoard({ cards: initial, counts }: { cards: BoardCard[]; counts: Record<string, number> }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lost, setLost] = useState<{ id: string; reason: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => setCards(initial), [initial]);

  const move = (id: string, stage: StageKey, lostReason?: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    if (stage === "LOST" && !lostReason) return setLost({ id, reason: "" });
    const previous = cards;
    setCards(cards.map((c) => (c.id === id ? { ...c, stage } : c))); // optimistic
    setError("");
    // Not gated by a busy flag: several cards can be moved in quick succession.
    void (async () => {
      const res = await setStage({ id, stage, lostReason }).catch(() => ({ error: "Could not save. Try again." }) as { error?: string });
      if (res.error) {
        setCards(previous);
        setError(res.error);
      } else router.refresh();
    })();
  };

  return (
    <div>
      {error ? <p role="alert" className="mb-2 text-sm font-medium">⚠ {error}</p> : null}
      {lost ? (
        <div role="dialog" aria-label="Lost reason" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border-2 border-navy-700 bg-white px-3 py-2 text-sm">
          <span className="font-semibold">Why was {cards.find((c) => c.id === lost.id)?.name} lost?</span>
          <select aria-label="Lost reason" className="input mt-0 w-auto" value={lost.reason} onChange={(e) => setLost({ ...lost, reason: e.target.value })}>
            <option value="">Choose…</option>
            {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button type="button" className="btn btn-sm" disabled={!lost.reason} onClick={() => { move(lost.id, "LOST", lost.reason); setLost(null); }}>Mark lost</button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setLost(null)}>Cancel</button>
        </div>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {STAGES.map((stage) => {
          const list = cards.filter((c) => c.stage === stage);
          return (
            <section
              key={stage}
              aria-label={STAGE_LABELS[stage]}
              className={`w-64 shrink-0 rounded-lg border p-2 ${over === stage ? "border-navy-700 bg-navy-100" : "border-navy-100 bg-navy-50"}`}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (dragId) move(dragId, stage); setDragId(null); }}
            >
              <h2 className="mb-2 flex items-center justify-between px-1 text-sm">
                {STAGE_LABELS[stage]}
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-navy-800">{counts[stage] ?? 0}</span>
              </h2>
              <ul className="space-y-2">
                {list.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
                    onDragEnd={() => { setDragId(null); setOver(null); }}
                    className={`cursor-grab rounded-md border border-navy-100 bg-white p-2 shadow-sm active:cursor-grabbing ${dragId === c.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <Link href={`/leads/${c.id}`} className="text-sm font-medium leading-tight text-navy-900" draggable={false}>{c.name}</Link>
                      <TierBadge tier={c.tier} score={c.score} />
                    </div>
                    <p className="muted text-xs">{c.trade} · {c.city ?? "—"}{c.owner ? ` · ${c.owner}` : ""}</p>
                    {/* Works on phones, where drag and drop is not available. */}
                    <select aria-label={`Move ${c.name} to stage`} className="mt-1 w-full rounded border border-navy-100 bg-white px-1 py-0.5 text-xs" value={c.stage} onChange={(e) => move(c.id, e.target.value as StageKey)}>
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
              {list.length === 0 ? <p className="muted px-1 py-4 text-center text-xs">Drop a lead here</p> : null}
              {(counts[stage] ?? 0) > list.length ? <Link href={`/leads?stage=${stage}`} className="mt-2 block px-1 text-xs">See all {counts[stage]}</Link> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
