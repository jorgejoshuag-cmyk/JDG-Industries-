"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { importRows, type ImportResult } from "@/app/actions/import";
import { IMPORT_FIELDS, applyMapping, autoMapColumns, validateMappedRow, type ColumnMapping, type ImportFieldKey, type MappedRow } from "@/lib/csv-mapping";

type Row = Record<string, unknown>;
const MAX_ROWS = 10_000;
const MAX_BYTES = 15 * 1024 * 1024;
const BATCH = 500;

async function parseFile(file: File): Promise<{ headers: string[]; rows: Row[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const sheet = await readSheet(file);
    const [head, ...body] = sheet;
    const headers = (head ?? []).map((h, i) => (h == null || h === "" ? `Column ${i + 1}` : String(h)));
    const rows = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] instanceof Date ? (r[i] as Date).toISOString().slice(0, 10) : r[i]])));
    return { headers, rows };
  }
  if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) {
    return new Promise((resolve, reject) => {
      Papa.parse<Row>(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete: (res) => resolve({ headers: (res.meta.fields ?? []).filter(Boolean), rows: res.data }),
        error: (err) => reject(err),
      });
    });
  }
  throw new Error("Use a .csv or .xlsx file. Older .xls files: open in Excel and save as .xlsx or .csv.");
}

export function ImportWizard() {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const mapped = useMemo(() => rows.map((r) => applyMapping(r, mapping)), [rows, mapping]);
  const invalid = useMemo(() => mapped.filter((m) => validateMappedRow(m).length > 0).length, [mapped]);
  const usedFields = IMPORT_FIELDS.filter((f) => mapping[f.key]);

  const onFile = async (file: File | undefined) => {
    setError("");
    setResult(null);
    setRows([]);
    setHeaders([]);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is larger than 15 MB. Split it into smaller files.");
    try {
      const parsed = await parseFile(file);
      if (!parsed.headers.length || !parsed.rows.length) return setError("That file has no rows. The first row must be column headings.");
      if (parsed.rows.length > MAX_ROWS) return setError(`That file has ${parsed.rows.length.toLocaleString()} rows. The limit is ${MAX_ROWS.toLocaleString()} per import.`);
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMapColumns(parsed.headers));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    }
  };

  const run = async () => {
    setError("");
    const good = mapped.filter((m) => validateMappedRow(m).length === 0).map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v).slice(0, 1000)])) as MappedRow);
    const total: ImportResult = { found: rows.length, added: 0, updated: 0, review: 0, skipped: invalid, problems: [] };
    setProgress(0);
    for (let i = 0; i < good.length; i += BATCH) {
      const res = await importRows({ fileName, rows: good.slice(i, i + BATCH) });
      if (res.error) {
        setProgress(null);
        return setError(`${res.error} (${i} rows were imported before this.)`);
      }
      total.added! += res.added ?? 0;
      total.updated! += res.updated ?? 0;
      total.review! += res.review ?? 0;
      total.skipped! += res.skipped ?? 0;
      total.problems!.push(...(res.problems ?? []));
      setProgress(Math.min(100, Math.round(((i + BATCH) / good.length) * 100)));
    }
    setProgress(null);
    setResult(total);
    setRows([]);
    setHeaders([]);
  };

  return (
    <div className="space-y-5">
      <section className="card">
        <h2>1. Choose a file</h2>
        <p className="muted mt-1">CSV or Excel (.xlsx). The first row must be column headings. Up to {MAX_ROWS.toLocaleString()} rows.</p>
        <input type="file" accept=".csv,.tsv,.txt,.xlsx" aria-label="File to import" className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white" onChange={(e) => onFile(e.target.files?.[0])} />
        {error ? <p role="alert" className="mt-3 rounded-md border border-black px-3 py-2 text-sm font-medium">⚠ {error}</p> : null}
      </section>

      {result ? (
        <section className="card" role="status">
          <h2>Import finished</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li><strong>{result.added}</strong> new leads added</li>
            <li><strong>{result.updated}</strong> matched leads already in the system and were updated</li>
            <li><strong>{result.review}</strong> possible duplicates sent to <Link href="/duplicates">Duplicates</Link> for review</li>
            <li><strong>{result.skipped}</strong> rows skipped</li>
          </ul>
          {result.problems?.length ? (
            <details className="mt-2 text-sm"><summary className="cursor-pointer">Problems ({result.problems.length} shown)</summary><ul className="muted mt-1 list-disc pl-5">{result.problems.slice(0, 20).map((p, i) => <li key={i}>{p}</li>)}</ul></details>
          ) : null}
          <Link href="/leads?source=csv_import&sort=newest" className="btn mt-4">View imported leads</Link>
        </section>
      ) : null}

      {headers.length ? (
        <>
          <section className="card">
            <h2>2. Match your columns</h2>
            <p className="muted mt-1">{fileName} · {rows.length.toLocaleString()} rows. We guessed the matches below — fix any that are wrong.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`map-${f.key}`}>{f.label}{"required" in f && f.required ? " *" : ""}</label>
                  <select id={`map-${f.key}`} className="input" value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key as ImportFieldKey]: e.target.value || undefined })}>
                    <option value="">— not in this file —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>3. Preview and import</h2>
            {!mapping.name ? (
              <p className="mt-2 text-sm font-medium">⚠ Choose which column holds the company name.</p>
            ) : (
              <>
                <p className="muted mt-1">First {Math.min(10, mapped.length)} rows as they will be imported.{invalid ? ` ${invalid.toLocaleString()} row${invalid === 1 ? "" : "s"} with no company name will be skipped.` : ""}</p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-navy-100">
                  <table className="table">
                    <thead><tr>{usedFields.map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                    <tbody>
                      {mapped.slice(0, 10).map((m, i) => (
                        <tr key={i} className={validateMappedRow(m).length ? "text-neutral-400 line-through" : undefined}>
                          {usedFields.map((f) => <td key={f.key} className="max-w-[14rem] truncate">{m[f.key] ?? ""}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn" disabled={progress !== null || rows.length === invalid} onClick={run}>
                    {progress !== null ? `Importing… ${progress}%` : `Import ${(rows.length - invalid).toLocaleString()} rows`}
                  </button>
                  <p className="muted">Companies already in the system are updated, not duplicated. Businesses only — records that look like private homeowners are flagged and hidden.</p>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
