"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { classifyProjectType } from "@/lib/classify";
import { IMPORT_FIELDS, parseDate, parseNumber, validateMappedRow, type MappedRow } from "@/lib/csv-mapping";
import { ingestRecords } from "@/lib/ingest";
import { requireUser } from "@/lib/session";
import type { NormalizedRecord } from "@/lib/sources/types";

const rowSchema = z.object(Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, z.string().max(1000).optional()])));
const payloadSchema = z.object({ fileName: z.string().max(200), rows: z.array(rowSchema).min(1).max(1000) });

export type ImportResult = { error?: string; found?: number; added?: number; updated?: number; review?: number; skipped?: number; problems?: string[] };

/** The CSV / Excel adapter's normalize step: one mapped spreadsheet row → one normalized record. */
function normalizeRow(row: MappedRow): NormalizedRecord {
  const record: NormalizedRecord = {
    company: {
      name: row.name as string, trade: row.trade, licenseNumber: row.licenseNumber, address: row.address, city: row.city,
      county: row.county, zip: row.zip, phone: row.phone, email: row.email, website: row.website,
    },
  };
  if (row.contactName) record.contact = { name: row.contactName, title: row.contactTitle };
  if (row.projectNumber) {
    record.project = {
      externalId: row.projectNumber,
      type: classifyProjectType(row.projectType, row.projectDescription),
      description: row.projectDescription,
      address: row.projectAddress,
      city: row.city,
      county: row.county,
      zip: row.zip,
      declaredValue: parseNumber(row.projectValue),
      areaSqFt: parseNumber(row.projectAreaSqFt),
      issueDate: parseDate(row.projectIssueDate),
      status: "Issued",
    };
  }
  return record;
}

/** Imports one batch of already-mapped rows. The browser sends large files in batches of 500. */
export async function importRows(input: { fileName: string; rows: MappedRow[] }): Promise<ImportResult> {
  const user = await requireUser();
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { error: "The file could not be read. Check that every cell is plain text under 1,000 characters." };

  const records: NormalizedRecord[] = [];
  const problems: string[] = [];
  parsed.data.rows.forEach((row, i) => {
    const issues = validateMappedRow(row as MappedRow);
    if (issues.length) {
      if (problems.length < 10) problems.push(`Row ${i + 1}: ${issues.join(", ")}`);
    } else records.push(normalizeRow(row as MappedRow));
  });

  const result = await ingestRecords("csv_import", records);
  await audit(user.id, "import.file", "Company", null, { fileName: parsed.data.fileName, rows: parsed.data.rows.length, added: result.added, updated: result.updated });
  return {
    found: parsed.data.rows.length,
    added: result.added,
    updated: result.updated,
    review: result.review,
    skipped: result.skipped + (parsed.data.rows.length - records.length),
    problems: [...problems, ...result.errors.slice(0, 10)],
  };
}
