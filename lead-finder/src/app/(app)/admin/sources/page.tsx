import { runSourceNow, saveSource } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader, fmtDateTime } from "@/components/ui";
import { PROJECT_TYPES, TRADES } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ADAPTERS, getSourceConfig } from "@/lib/sources";
import { MAPPABLE_FIELDS } from "@/lib/sources/config";

export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  await requireAdmin();
  const sources = await Promise.all(
    ADAPTERS.map(async (a) => {
      const config = await getSourceConfig(a.key);
      const lastRun = await db.sourceRun.findFirst({ where: { sourceKey: a.key }, orderBy: { startedAt: "desc" } });
      return { adapter: a, config, lastRun, notReady: a.notReadyReason(config) as string | null };
    }),
  );
  return (
    <>
      <PageHeader title="Lead sources" subtitle="Sources that are turned on run automatically once a day. File import and manual entry are always available and need no setup." />
      <div className="card mb-5 text-sm">
        <p><strong>How to set up a source:</strong> find the official open-data dataset, copy its JSON endpoint here, and type in the dataset&apos;s own column names next to the fields you want. Use <code className="rounded bg-navy-50 px-1">{"{limit}"}</code> and <code className="rounded bg-navy-50 px-1">{"{offset}"}</code> in the URL if the dataset supports paging.</p>
        <p className="muted mt-2">Only use official APIs and open-data portals whose terms allow this use. Do not point this at websites that prohibit automated access or require a login.</p>
      </div>
      <ul className="space-y-4">
        {sources.map(({ adapter, config, lastRun, notReady }) => (
          <li key={adapter.key} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2>{adapter.label}</h2>
                <p className="muted">{adapter.description}</p>
                <p className="mt-1 text-sm"><strong>{notReady ? `Not running: ${notReady}` : "Ready — runs daily"}</strong>{lastRun ? <span className="muted"> · last run {fmtDateTime(lastRun.startedAt)}: {lastRun.status}, found {lastRun.found}, added {lastRun.added}</span> : <span className="muted"> · never run</span>}</p>
              </div>
              <ActionForm action={runSourceNow}>
                <input type="hidden" name="key" value={adapter.key} />
                <SubmitButton className="btn-secondary" pendingText="Running…">Run now</SubmitButton>
              </ActionForm>
            </div>
            <details className="mt-3 border-t border-navy-100 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-navy-800">Set up</summary>
              <ActionForm action={saveSource} className="mt-3 space-y-3">
                <input type="hidden" name="key" value={adapter.key} />
                <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="enabled" defaultChecked={config.enabled} /> Turned on</label>
                {config.kind === "places" ? (
                  <>
                    <p className="muted">{process.env.GOOGLE_PLACES_API_KEY ? "Google Places API key found." : "⚠ GOOGLE_PLACES_API_KEY is not set in the environment, so this source cannot run."} Each search uses paid Google API calls. Review Google&apos;s terms on storing Places data before turning this on.</p>
                    <div><label htmlFor="queries">Searches (one per line, up to 25)</label><textarea id="queries" name="queries" rows={6} defaultValue={config.queries.join("\n")} className="input" /></div>
                    <div><label htmlFor="mpq">Result pages per search (1–3, 20 results each)</label><input id="mpq" name="maxPagesPerQuery" type="number" min={1} max={3} defaultValue={config.maxPagesPerQuery} className="input w-24" /></div>
                  </>
                ) : (
                  <>
                    <div><label htmlFor={`url-${adapter.key}`}>JSON endpoint URL (https)</label><input id={`url-${adapter.key}`} name="url" defaultValue={config.url} maxLength={1000} placeholder="https://…/resource/xxxx-xxxx.json?$limit={limit}&$offset={offset}" className="input font-mono text-[13px]" /></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><label htmlFor={`rp-${adapter.key}`}>Records path</label><input id={`rp-${adapter.key}`} name="recordsPath" defaultValue={config.recordsPath} maxLength={120} placeholder="blank if the response is a list" className="input" /></div>
                      <div><label htmlFor={`ps-${adapter.key}`}>Page size</label><input id={`ps-${adapter.key}`} name="pageSize" type="number" min={1} max={5000} defaultValue={config.pageSize} className="input" /></div>
                      <div><label htmlFor={`mp-${adapter.key}`}>Max pages per run</label><input id={`mp-${adapter.key}`} name="maxPages" type="number" min={1} max={50} defaultValue={config.maxPages} className="input" /></div>
                    </div>
                    <div><label htmlFor={`h-${adapter.key}`}>Extra request headers (JSON, optional)</label><input id={`h-${adapter.key}`} name="headers" defaultValue={Object.keys(config.headers).length ? JSON.stringify(config.headers) : ""} maxLength={2000} placeholder='{"X-App-Token": "…"}' className="input font-mono text-[13px]" /></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><label htmlFor={`dt-${adapter.key}`}>Trade for every record</label><select id={`dt-${adapter.key}`} name="defaultTrade" defaultValue={config.defaultTrade} className="input"><option value="">Work it out from the text</option>{TRADES.map((t) => <option key={t}>{t}</option>)}</select></div>
                      <div><label htmlFor={`dp-${adapter.key}`}>Project type for every record</label><select id={`dp-${adapter.key}`} name="defaultProjectType" defaultValue={config.defaultProjectType} className="input"><option value="">Work it out from the text</option>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                      <div><label htmlFor={`dc-${adapter.key}`}>County for every record</label><input id={`dc-${adapter.key}`} name="defaultCounty" defaultValue={config.defaultCounty} maxLength={40} placeholder="e.g. Broward" className="input" /></div>
                    </div>
                    <fieldset>
                      <legend className="text-sm font-medium text-navy-900">Column names in the dataset</legend>
                      <p className="muted">Type the dataset&apos;s column name next to each field you want. Company name is required. Leave the rest blank if the dataset does not have them.</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {MAPPABLE_FIELDS.map((f) => (
                          <div key={f} className="flex items-center gap-2">
                            <label htmlFor={`m-${adapter.key}-${f}`} className="w-36 shrink-0 text-xs font-normal">{f}{f === "name" ? " *" : ""}</label>
                            <input id={`m-${adapter.key}-${f}`} name={`map:${f}`} defaultValue={config.fieldMap[f] ?? ""} maxLength={120} className="input mt-0 py-1 font-mono text-[13px]" />
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
                <SubmitButton>Save source</SubmitButton>
              </ActionForm>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
