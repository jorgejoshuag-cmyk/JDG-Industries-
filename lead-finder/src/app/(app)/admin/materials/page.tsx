import { saveAssumptions } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { PROJECT_TYPES } from "@/lib/constants";
import { db } from "@/lib/db";
import { DEFAULT_ASSUMPTIONS } from "@/lib/materials";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Material estimates" };

export default async function MaterialsPage() {
  await requireAdmin();
  const stored = await db.materialAssumption.findMany();
  const rows = PROJECT_TYPES.map((t) => stored.find((s) => s.projectType === t) ?? DEFAULT_ASSUMPTIONS.find((d) => d.projectType === t) ?? { projectType: t, material: "", depthInches: 4, tonsPerCubicYard: 1.4, tonsPer10kValue: 2 });
  return (
    <>
      <PageHeader title="Material estimate assumptions" subtitle="Used for the rough tonnage shown on each project. These are starting guesses, not engineering numbers — set them from your own experience." />
      <ActionForm action={saveAssumptions} className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Project type</th><th>Likely materials</th><th>Depth (in)</th><th>Tons per cu yd</th><th>Tons per $10k of value</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.projectType}>
                  <td className="whitespace-nowrap font-medium">{r.projectType}</td>
                  <td><input aria-label={`${r.projectType} materials`} name={`material:${r.projectType}`} defaultValue={r.material} required maxLength={200} className="input mt-0 min-w-[14rem]" /></td>
                  <td><input aria-label={`${r.projectType} depth`} name={`depth:${r.projectType}`} type="number" step="0.5" min={0} max={120} defaultValue={r.depthInches} className="input mt-0 w-24" /></td>
                  <td><input aria-label={`${r.projectType} tons per cubic yard`} name={`tpcy:${r.projectType}`} type="number" step="0.05" min={0.1} max={5} defaultValue={r.tonsPerCubicYard} className="input mt-0 w-24" /></td>
                  <td><input aria-label={`${r.projectType} tons per ten thousand dollars`} name={`tpv:${r.projectType}`} type="number" step="0.5" min={0} max={1000} defaultValue={r.tonsPer10kValue} className="input mt-0 w-24" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt-3">When a project&apos;s area is known: area × depth ÷ 27 = cubic yards, × tons per cubic yard. Otherwise: declared value ÷ $10,000 × tons per $10k.</p>
        <div className="mt-3"><SubmitButton>Save assumptions</SubmitButton></div>
      </ActionForm>
    </>
  );
}
