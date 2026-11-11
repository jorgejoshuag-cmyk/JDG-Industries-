import { addServiceZips, removeServiceZip, saveSettings } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const [s, zips] = await Promise.all([getSettings(), db.serviceZip.findMany({ orderBy: { zip: "asc" } })]);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ActionForm action={saveSettings} className="card space-y-3">
          <h2>Company and yard</h2>
          <div><label htmlFor="company_name">Company name (used in outreach)</label><input id="company_name" name="company_name" defaultValue={s.company_name} required maxLength={100} className="input" /></div>
          <div>
            <label htmlFor="business_address">Business postal address</label>
            <input id="business_address" name="business_address" defaultValue={s.business_address} maxLength={300} className="input" placeholder="Street, City, FL ZIP" />
            <p className="muted mt-1">{s.business_address ? "Added to the bottom of every email draft." : "⚠ Not set. Commercial email must include your postal address — add it before sending email drafts."}</p>
          </div>
          <div><label htmlFor="yard_address">Yard address (for your reference)</label><input id="yard_address" name="yard_address" defaultValue={s.yard_address} maxLength={300} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="yard_lat">Yard latitude</label><input id="yard_lat" name="yard_lat" defaultValue={s.yard_lat} maxLength={20} inputMode="decimal" className="input" /></div>
            <div><label htmlFor="yard_lng">Yard longitude</label><input id="yard_lng" name="yard_lng" defaultValue={s.yard_lng} maxLength={20} inputMode="decimal" className="input" /></div>
          </div>
          <p className="muted">Distance scoring uses the latitude and longitude. To find them: right-click your yard in Google Maps and click the numbers at the top of the menu to copy them.</p>
          <div><label htmlFor="service_counties">Service counties (comma separated)</label><input id="service_counties" name="service_counties" defaultValue={s.service_counties} maxLength={300} className="input" /></div>
          <SubmitButton pendingText="Saving and re-scoring…">Save settings</SubmitButton>
        </ActionForm>

        <div className="card">
          <h2>Extra service ZIP codes</h2>
          <p className="muted mt-1">Leads in a service county are already counted as in-area. Add ZIPs here to also include places outside those counties, or leave as is.</p>
          <ActionForm action={addServiceZips} resetOnSuccess className="mt-3 flex items-end gap-2">
            <div className="flex-1"><label htmlFor="zips">Add ZIP codes</label><input id="zips" name="zips" placeholder="33441, 33442" maxLength={5000} className="input" /></div>
            <SubmitButton className="btn-secondary">Add</SubmitButton>
          </ActionForm>
          <ul className="mt-4 flex flex-wrap gap-2">
            {zips.map((z) => (
              <li key={z.zip} className="inline-flex items-center overflow-hidden rounded-full border border-navy-200 text-sm">
                <span className="px-2.5 py-0.5">{z.zip}{z.city ? <span className="muted"> {z.city}</span> : null}</span>
                <ActionForm action={removeServiceZip} className="contents">
                  <input type="hidden" name="zip" value={z.zip} />
                  <button type="submit" aria-label={`Remove ${z.zip}`} className="border-l border-navy-200 px-1.5 text-neutral-500 hover:bg-navy-50">×</button>
                </ActionForm>
              </li>
            ))}
          </ul>
          {zips.length === 0 ? <p className="muted mt-3">No extra ZIP codes.</p> : null}
        </div>
      </div>
    </>
  );
}
