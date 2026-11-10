"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBusy } from "./useBusy";
import { setStage } from "@/app/actions/leads";
import { LOST_REASONS, STAGES, STAGE_LABELS } from "@/lib/constants";

/** Stage picker that asks for a reason when a lead is marked Lost. */
export function StageControl({ id, stage, lostReason }: { id: string; stage: string; lostReason: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const [reason, setReason] = useState(lostReason ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useBusy();

  const save = (next: string, why?: string) =>
    start(async () => {
      setError("");
      const res = await setStage({ id, stage: next, lostReason: why });
      if (res.error) setError(res.error);
      else router.refresh();
    });

  return (
    <div>
      <label htmlFor="stage-control">Stage</label>
      <select
        id="stage-control"
        className="input"
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value !== "LOST") save(e.target.value);
        }}
      >
        {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
      </select>
      {value === "LOST" ? (
        <div className="mt-2 flex gap-2">
          <select aria-label="Lost reason" className="input mt-0" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Lost reason…</option>
            {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button type="button" className="btn btn-sm" disabled={pending || !reason} onClick={() => save("LOST", reason)}>Save</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-sm font-medium">⚠ {error}</p> : null}
    </div>
  );
}
