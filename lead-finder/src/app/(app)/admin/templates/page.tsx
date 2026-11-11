import { deleteTemplate, saveTemplate } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { MERGE_FIELDS } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Templates" };

const CHANNELS = [["EMAIL", "Email"], ["TEXT", "Text"], ["CALL", "Call script"]] as const;

export default async function TemplatesPage() {
  await requireAdmin();
  const templates = await db.outreachTemplate.findMany({ orderBy: [{ channel: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Outreach templates" subtitle="Drafts are created from these. Staff review and send each message themselves." />
      <div className="card mb-5 text-sm">
        <p><strong>Merge fields:</strong> {MERGE_FIELDS.map((f) => <code key={f} className="mr-2 rounded bg-navy-50 px-1">{`{{${f}}}`}</code>)}</p>
        <p className="muted mt-2">Every email automatically gets your business address and an opt-out line added at the bottom. Texts automatically get “Reply STOP to opt out.”</p>
      </div>
      {templates.length === 0 ? <Empty title="No templates yet">Add your first one below.</Empty> : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="card">
              <details>
                <summary className="cursor-pointer font-semibold text-navy-900">{CHANNELS.find((c) => c[0] === t.channel)?.[1]} · {t.name}{t.active ? "" : " (off)"}</summary>
                <ActionForm action={saveTemplate} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={t.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2"><label htmlFor={`name-${t.id}`}>Name</label><input id={`name-${t.id}`} name="name" defaultValue={t.name} required maxLength={100} className="input" /></div>
                    <div><label htmlFor={`ch-${t.id}`}>Channel</label><select id={`ch-${t.id}`} name="channel" defaultValue={t.channel} className="input">{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  </div>
                  <div><label htmlFor={`sub-${t.id}`}>Subject (email only)</label><input id={`sub-${t.id}`} name="subject" defaultValue={t.subject ?? ""} maxLength={200} className="input" /></div>
                  <div><label htmlFor={`body-${t.id}`}>Message</label><textarea id={`body-${t.id}`} name="body" defaultValue={t.body} required rows={8} maxLength={5000} className="input font-mono text-[13px]" /></div>
                  <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="active" defaultChecked={t.active} /> Available to staff</label>
                  <SubmitButton>Save template</SubmitButton>
                </ActionForm>
                <ActionForm action={deleteTemplate} confirm={`Delete the template “${t.name}”?`} className="mt-2">
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="text-xs text-neutral-500 hover:underline">Delete template</button>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={saveTemplate} resetOnSuccess className="card mt-6 space-y-3">
        <h2>Add a template</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><label htmlFor="new-name">Name</label><input id="new-name" name="name" required maxLength={100} className="input" /></div>
          <div><label htmlFor="new-ch">Channel</label><select id="new-ch" name="channel" className="input">{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        <div><label htmlFor="new-sub">Subject (email only)</label><input id="new-sub" name="subject" maxLength={200} className="input" /></div>
        <div><label htmlFor="new-body">Message</label><textarea id="new-body" name="body" required rows={6} maxLength={5000} className="input font-mono text-[13px]" placeholder="Hi {{contact_name}}, …" /></div>
        <SubmitButton>Add template</SubmitButton>
      </ActionForm>
    </>
  );
}
