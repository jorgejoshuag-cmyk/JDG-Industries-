// Do-not-contact rules. Pure functions; the callers supply the suppression list.

import { normalizeEmail, normalizePhone } from "./normalize";

export type Contactable = {
  doNotContact: boolean;
  likelyHomeowner: boolean;
  phone?: string | null;
  email?: string | null;
};

export type SuppressionSet = { emails: Set<string>; phones: Set<string> };

export function buildSuppressionSet(rows: { kind: string; value: string }[]): SuppressionSet {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const r of rows) {
    if (r.kind === "email") emails.add(r.value.toLowerCase());
    else if (r.kind === "phone") phones.add(r.value);
  }
  return { emails, phones };
}

/** Why this lead must not be contacted, or null when outreach is allowed. */
export function contactBlockReason(c: Contactable, s: SuppressionSet): string | null {
  if (c.doNotContact) return "This lead is on the do-not-contact list.";
  if (c.likelyHomeowner) return "This record looks like a private homeowner. Business contacts only.";
  const email = normalizeEmail(c.email);
  if (email && s.emails.has(email)) return "This email address has opted out.";
  const phone = normalizePhone(c.phone);
  if (phone && s.phones.has(phone)) return "This phone number has opted out.";
  return null;
}

export function canContact(c: Contactable, s: SuppressionSet): boolean {
  return contactBlockReason(c, s) === null;
}

/** Drops every lead that may not be contacted. Used by exports and draft generation. */
export function filterContactable<T extends Contactable>(rows: T[], s: SuppressionSet): T[] {
  return rows.filter((r) => canContact(r, s));
}
