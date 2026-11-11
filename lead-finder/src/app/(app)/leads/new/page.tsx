import Link from "next/link";
import { quickAddLead } from "@/app/actions/leads";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { COUNTIES, TRADES } from "@/lib/constants";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Quick add lead" };

export default async function NewLeadPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Quick add lead" subtitle="For leads from calls, referrals and drive-bys. Businesses only." />
      <ActionForm action={quickAddLead} className="card max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="name">Company name *</label><input id="name" name="name" required minLength={2} maxLength={200} className="input" autoFocus /></div>
          <div><label htmlFor="trade">Trade *</label><select id="trade" name="trade" required defaultValue="General Contractor" className="input">{TRADES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" maxLength={40} className="input" /></div>
          <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" maxLength={200} className="input" /></div>
          <div><label htmlFor="website">Website</label><input id="website" name="website" maxLength={300} className="input" /></div>
          <div><label htmlFor="contactName">Contact name</label><input id="contactName" name="contactName" maxLength={120} className="input" /></div>
          <div><label htmlFor="contactTitle">Contact title</label><input id="contactTitle" name="contactTitle" maxLength={80} className="input" /></div>
          <div className="sm:col-span-2"><label htmlFor="address">Address</label><input id="address" name="address" maxLength={300} className="input" /></div>
          <div><label htmlFor="city">City</label><input id="city" name="city" maxLength={80} className="input" /></div>
          <div><label htmlFor="county">County</label><select id="county" name="county" defaultValue="" className="input"><option value="">Unknown / other</option>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="zip">ZIP</label><input id="zip" name="zip" inputMode="numeric" maxLength={10} className="input" /></div>
          <div><label htmlFor="licenseNumber">License number</label><input id="licenseNumber" name="licenseNumber" maxLength={40} className="input" /></div>
          <div className="sm:col-span-2"><label htmlFor="note">Note</label><textarea id="note" name="note" rows={3} maxLength={2000} className="input" placeholder="Where the lead came from, what they need, when." /></div>
        </div>
        <p className="muted mt-3">If this company is already in the system, the new details are added to the existing lead instead of creating a duplicate.</p>
        <div className="mt-4 flex gap-2">
          <SubmitButton pendingText="Saving…">Save lead</SubmitButton>
          <Link href="/leads" className="btn-secondary">Cancel</Link>
        </div>
      </ActionForm>
    </>
  );
}
