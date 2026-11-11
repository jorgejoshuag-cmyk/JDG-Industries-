import { saveScoringRules } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DEFAULT_RULES } from "@/lib/scoring";

export const metadata = { title: "Scoring" };

const HELP: Record<string, string> = {
  trade_fit: "Concrete, site work and paving contractors score highest; unrelated trades lowest.",
  service_area: "Full points when the lead is in a service county or on the service ZIP list.",
  distance: "Full points within 10 miles of the yard, less out to 35 miles.",
  recent_permits: "Full points for a permit or bid in the last 30 days, less at 60 and 90.",
  project_type: "Slabs, driveways, paving and site work score highest.",
  project_value: "Based on the largest declared project value on file.",
  active_projects: "More open projects means more points (3 or more for full).",
  contact_info: "Phone, email and a named contact.",
  engagement: "Leads that have shown interest or asked for a quote.",
};

export default async function ScoringPage() {
  await requireAdmin();
  const stored = await db.scoringRule.findMany();
  const rules = DEFAULT_RULES.map((d) => stored.find((s) => s.key === d.key) ?? d);
  const total = rules.filter((r) => r.enabled).reduce((s, r) => s + r.weight, 0);
  return (
    <>
      <PageHeader title="Lead scoring" subtitle="Each rule's weight is its share of the 0–100 score. Hot is 75 and up, Warm is 50–74, Cold is below 50." />
      <ActionForm action={saveScoringRules} className="card max-w-3xl">
        <table className="table">
          <thead><tr><th>On</th><th>Rule</th><th className="w-28">Weight</th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.key}>
                <td><input type="checkbox" name={`enabled:${r.key}`} defaultChecked={r.enabled} aria-label={`Use ${r.label}`} /></td>
                <td><label htmlFor={`w-${r.key}`}>{r.label}</label><p className="muted">{HELP[r.key]}</p></td>
                <td><input id={`w-${r.key}`} name={`weight:${r.key}`} type="number" min={0} max={100} step={1} defaultValue={r.weight} className="input mt-0" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted mt-3">Weights currently add up to {total}. They do not need to total 100 — they are scaled automatically.</p>
        <div className="mt-3"><SubmitButton pendingText="Re-scoring every lead…">Save and re-score all leads</SubmitButton></div>
      </ActionForm>
    </>
  );
}
