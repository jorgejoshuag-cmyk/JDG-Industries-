import { describe, expect, it } from "vitest";
import { buildSuppressionSet, canContact, contactBlockReason, filterContactable } from "@/lib/dnc";
import { emailFooter, fillMergeFields, renderDraft, OPT_OUT_LINE } from "@/lib/templates";

const none = buildSuppressionSet([]);
const lead = { doNotContact: false, likelyHomeowner: false, phone: "3055550142", email: "office@example.com" };

describe("do-not-contact enforcement", () => {
  it("allows a normal business lead", () => {
    expect(canContact(lead, none)).toBe(true);
  });
  it("blocks flagged leads", () => {
    expect(canContact({ ...lead, doNotContact: true }, none)).toBe(false);
    expect(contactBlockReason({ ...lead, likelyHomeowner: true }, none)).toMatch(/homeowner/i);
  });
  it("blocks suppressed emails and phones regardless of formatting", () => {
    const s = buildSuppressionSet([
      { kind: "email", value: "office@example.com" },
      { kind: "phone", value: "9545550101" },
    ]);
    expect(canContact({ ...lead, email: " Office@Example.com " }, s)).toBe(false);
    expect(canContact({ ...lead, email: null, phone: "(954) 555-0101" }, s)).toBe(false);
    expect(canContact({ ...lead, email: "other@example.com" }, s)).toBe(true);
  });
  it("filters blocked leads out of an export list", () => {
    const s = buildSuppressionSet([{ kind: "email", value: "optout@example.com" }]);
    const rows = [
      { id: 1, ...lead },
      { id: 2, ...lead, doNotContact: true },
      { id: 3, ...lead, email: "optout@example.com" },
      { id: 4, ...lead, likelyHomeowner: true },
    ];
    expect(filterContactable(rows, s).map((r) => r.id)).toEqual([1]);
  });
});

describe("templates", () => {
  const vars = {
    company_name: "Sunrise Concrete", contact_name: "Ana", project_type: "driveway", jobsite_city: "Hialeah",
    material_suggestions: "limerock base", sender_name: "Sam", our_company: "JDG Aggregates",
  };
  const sender = { companyName: "JDG Aggregates", businessAddress: "100 Example Rd, Miami, FL 33166" };

  it("fills merge fields and leaves unknown ones visible", () => {
    expect(fillMergeFields("Hi {{contact_name}} at {{ company_name }} {{nope}}", vars)).toBe("Hi Ana at Sunrise Concrete {{nope}}");
  });
  it("always adds the business address and opt-out line to email", () => {
    const d = renderDraft({ channel: "EMAIL", subject: "Material for {{jobsite_city}}", body: "Hello {{contact_name}}" }, vars, sender);
    expect(d.subject).toBe("Material for Hialeah");
    expect(d.body).toContain("100 Example Rd, Miami, FL 33166");
    expect(d.body).toContain(OPT_OUT_LINE);
  });
  it("makes a missing business address obvious", () => {
    expect(emailFooter({ companyName: "JDG Aggregates", businessAddress: "" })).toMatch(/ADD YOUR BUSINESS ADDRESS/);
  });
  it("adds STOP wording to texts and nothing extra to call scripts", () => {
    expect(renderDraft({ channel: "TEXT", body: "Hi {{contact_name}}" }, vars, sender).body).toMatch(/STOP/);
    expect(renderDraft({ channel: "CALL", body: "Hi {{contact_name}}" }, vars, sender).body).toBe("Hi Ana");
  });
});
