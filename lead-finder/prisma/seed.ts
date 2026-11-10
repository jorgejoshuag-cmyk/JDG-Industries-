// Seeds configuration (always) and fictional sample leads (only into an empty database).
// Every company, person, phone number and email below is made up. Phone numbers use the 555-01xx
// range reserved for fiction and emails use example.com.

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { ingestRecords } from "../src/lib/ingest";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/materials";
import { rescoreAll } from "../src/lib/rescore";
import { DEFAULT_RULES } from "../src/lib/scoring";
import type { NormalizedRecord } from "../src/lib/sources/types";

// Small deterministic random generator so the sample data is the same on every run.
let seed = 20261110;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const PLACES = [
  { city: "Miami", county: "Miami-Dade", zip: "33142", lat: 25.812, lng: -80.232 },
  { city: "Hialeah", county: "Miami-Dade", zip: "33012", lat: 25.865, lng: -80.3 },
  { city: "Doral", county: "Miami-Dade", zip: "33178", lat: 25.84, lng: -80.37 },
  { city: "Medley", county: "Miami-Dade", zip: "33166", lat: 25.83, lng: -80.31 },
  { city: "Kendall", county: "Miami-Dade", zip: "33186", lat: 25.66, lng: -80.41 },
  { city: "Homestead", county: "Miami-Dade", zip: "33030", lat: 25.47, lng: -80.48 },
  { city: "Miami Beach", county: "Miami-Dade", zip: "33139", lat: 25.78, lng: -80.14 },
  { city: "North Miami Beach", county: "Miami-Dade", zip: "33160", lat: 25.94, lng: -80.14 },
  { city: "Opa-locka", county: "Miami-Dade", zip: "33054", lat: 25.9, lng: -80.25 },
  { city: "Miami Gardens", county: "Miami-Dade", zip: "33056", lat: 25.94, lng: -80.25 },
  { city: "Fort Lauderdale", county: "Broward", zip: "33301", lat: 26.12, lng: -80.13 },
  { city: "Hollywood", county: "Broward", zip: "33020", lat: 26.01, lng: -80.15 },
  { city: "Pompano Beach", county: "Broward", zip: "33060", lat: 26.24, lng: -80.12 },
  { city: "Deerfield Beach", county: "Broward", zip: "33441", lat: 26.31, lng: -80.1 },
  { city: "Pembroke Pines", county: "Broward", zip: "33024", lat: 26.02, lng: -80.24 },
  { city: "Coral Springs", county: "Broward", zip: "33065", lat: 26.27, lng: -80.26 },
  { city: "Weston", county: "Broward", zip: "33326", lat: 26.1, lng: -80.39 },
  { city: "Davie", county: "Broward", zip: "33314", lat: 26.06, lng: -80.21 },
  { city: "Miramar", county: "Broward", zip: "33025", lat: 25.98, lng: -80.28 },
  { city: "Oakland Park", county: "Broward", zip: "33334", lat: 26.17, lng: -80.13 },
] as const;

const PREFIXES = [
  "Sunrise", "Atlantic", "Gold Coast", "Everglades", "Biscayne", "Tropic", "Palmetto", "Coral Reef", "Seagrape", "Mangrove",
  "Royal Palm", "Bayfront", "Ironshore", "Keystone", "Blue Heron", "Sawgrass", "Flamingo", "Tradewinds", "Sandbar", "Cypress",
  "Lighthouse", "Gulfstream", "Hammock", "Banyan", "Pelican", "Osprey", "Southwind", "Harborline", "Stonecrab", "Limestone",
];

const TRADE_NAMES: [string, string[]][] = [
  ["Concrete Contractor", ["Concrete", "Concrete & Flatwork", "Ready Slab Concrete"]],
  ["General Contractor", ["General Contractors", "Construction Group", "Builders & Contracting"]],
  ["Site Work / Excavation", ["Site Work", "Excavation & Grading", "Earthworks"]],
  ["Paving / Driveway", ["Paving", "Asphalt & Paving", "Driveways"]],
  ["Paver Installer", ["Pavers", "Brick Pavers"]],
  ["Pool Builder", ["Pools", "Pool Builders"]],
  ["Landscaper", ["Landscaping", "Landscape & Irrigation"]],
  ["Masonry / Foundation", ["Masonry", "Foundations"]],
  ["Septic / Drainfield", ["Septic & Drainfield"]],
  ["Plumbing (Underground)", ["Plumbing"]],
  ["Developer", ["Development Partners"]],
  ["Home Builder", ["Custom Homes", "Home Builders"]],
  ["Property Manager", ["Property Management"]],
];
const SUFFIXES = ["LLC", "Inc", "Corp", "LLC", "Inc"];
const FIRST = ["Ana", "Luis", "Maria", "Carlos", "Diane", "Marcus", "Yvette", "Rafael", "Tanya", "Hector", "Nicole", "Andre", "Sofia", "Kevin", "Priya"];
const LAST = ["Alvarado", "Benitez", "Castellanos", "Duarte", "Echeverria", "Fontaine", "Gutierrez", "Herrera", "Iglesias", "Jaramillo", "Leclerc", "Montoya", "Navarro", "Okafor", "Pereira"];
const TITLES = ["Owner", "Estimator", "Project Manager", "Purchasing Manager", "Operations Manager", "Superintendent"];
const STREETS = ["NW 74th St", "W 20th Ave", "NW 58th St", "SW 137th Ave", "Krome Ave", "Okeechobee Rd", "Pembroke Rd", "Powerline Rd", "Griffin Rd", "Stirling Rd", "Dixie Hwy", "Andrews Ave", "University Dr", "Commercial Blvd"];

const PROJECT_DESCRIPTIONS: Record<string, string[]> = {
  "New Construction": ["New two-story single family residence", "New commercial warehouse shell", "New townhouse building, 6 units"],
  "Foundation / Slab": ["Monolithic slab and footings for addition", "Foundation and slab for retail building"],
  Driveway: ["Remove and replace concrete driveway and approach", "New circular driveway with limerock base"],
  Paving: ["Parking lot resurfacing and restriping", "New asphalt parking area with drainage"],
  Pool: ["New residential swimming pool and deck", "Commercial pool renovation and deck"],
  "Site Work": ["Site grading, fill and drainage for commercial lot", "Lot fill and compaction for new subdivision phase"],
  Demolition: ["Demolition of one-story structure and lot fill"],
};

async function seedConfig() {
  for (const r of DEFAULT_RULES) {
    await db.scoringRule.upsert({ where: { key: r.key }, update: { label: r.label }, create: r });
  }
  for (const a of DEFAULT_ASSUMPTIONS) {
    await db.materialAssumption.upsert({ where: { projectType: a.projectType }, update: {}, create: a });
  }
  for (const p of PLACES) {
    await db.serviceZip.upsert({ where: { zip: p.zip }, update: {}, create: { zip: p.zip, city: p.city, county: p.county } });
  }
  const settings: Record<string, string> = {
    company_name: "JDG Aggregates",
    business_address: "",
    yard_address: "Demo yard location (Medley area). Change this in Admin → Settings.",
    yard_lat: "25.84",
    yard_lng: "-80.33",
    service_counties: "Miami-Dade,Broward",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  if ((await db.outreachTemplate.count()) === 0) {
    await db.outreachTemplate.createMany({
      data: [
        {
          name: "Intro email — active project",
          channel: "EMAIL",
          subject: "Material for your {{project_type}} job in {{jobsite_city}}",
          body: "Hi {{contact_name}},\n\nI saw that {{company_name}} has a {{project_type}} project underway in {{jobsite_city}}. {{our_company}} delivers {{material_suggestions}} across Miami-Dade and Broward, by the half or full truckload.\n\nIf you send me the jobsite address and the quantities you need, I can get you a delivered price today.\n\nThanks,\n{{sender_name}}\n{{our_company}}",
        },
        {
          name: "Intro email — general",
          channel: "EMAIL",
          subject: "Aggregate and concrete delivery for {{company_name}}",
          body: "Hi {{contact_name}},\n\nI'm reaching out from {{our_company}}. We supply and deliver {{material_suggestions}} to contractors in Miami-Dade and Broward.\n\nWho is the right person at {{company_name}} to send pricing to for your upcoming jobs?\n\nThanks,\n{{sender_name}}\n{{our_company}}",
        },
        {
          name: "Follow-up email",
          channel: "EMAIL",
          subject: "Following up — material pricing for {{company_name}}",
          body: "Hi {{contact_name}},\n\nFollowing up on my earlier note. If you have a job coming up that needs {{material_suggestions}}, I'm happy to quote it.\n\nThanks,\n{{sender_name}}\n{{our_company}}",
        },
        {
          name: "Text — existing contact follow-up",
          channel: "TEXT",
          body: "Hi {{contact_name}}, this is {{sender_name}} with {{our_company}}. Following up on material for your {{project_type}} job in {{jobsite_city}}. Want a delivered price?",
        },
        {
          name: "Call script — first call",
          channel: "CALL",
          body: "Hi, is this {{contact_name}}? This is {{sender_name}} with {{our_company}}.\n\nWe deliver {{material_suggestions}} in Miami-Dade and Broward. I saw {{company_name}} has a {{project_type}} job in {{jobsite_city}}.\n\nAsk:\n- Who handles material orders?\n- What do you have coming up in the next 30 days?\n- Who supplies you now, and what would make you try someone else?\n\nClose: Can I send you a delivered price for your next job? What's the best email?",
        },
      ],
    });
  }
}

async function seedUsers() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  let password = process.env.SEED_ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generated = true;
  }
  const admin = await db.user.create({ data: { email, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`\nAdmin login created: ${email}`);
  if (generated) console.log(`Temporary password (shown once): ${password}\n`);
  else console.log("Password: the value of SEED_ADMIN_PASSWORD\n");
  return admin;
}

async function seedSampleData(adminId: string) {
  if ((await db.company.count()) > 0) {
    console.log("Leads already exist — skipping sample data.");
    return;
  }
  const sales = await db.user.create({
    data: { email: "sales@example.com", name: "Sample Sales Rep", role: "SALES", active: false, passwordHash: await bcrypt.hash(randomBytes(18).toString("base64url"), 12) },
  });

  const records: NormalizedRecord[] = [];
  const usedNames = new Set<string>();
  let n = 0;
  while (records.length < 62) {
    const [trade, words] = TRADE_NAMES[n % TRADE_NAMES.length];
    const name = `${PREFIXES[(n * 7 + 3) % PREFIXES.length]} ${pick(words)} ${pick(SUFFIXES)}`;
    n++;
    const baseName = name.replace(/ (LLC|Inc|Corp)$/, "");
    if (usedNames.has(baseName)) continue;
    usedNames.add(baseName);
    const place = PLACES[records.length % PLACES.length];
    const i = records.length;
    const area = place.county === "Broward" ? "954" : "305";
    const slug = baseName.toLowerCase().replace(/[^a-z]+/g, "");
    const hasEmail = rnd() < 0.75;
    const hasPhone = rnd() < 0.9;
    const hasContact = rnd() < 0.7;
    records.push({
      company: {
        name,
        trade,
        licenseNumber: rnd() < 0.6 ? `${pick(["CGC", "CBC", "CUC", "CPC", "SCC"])}${1500000 + i * 137}` : null,
        address: `${1000 + Math.floor(rnd() * 8900)} ${pick(STREETS)}`,
        city: place.city,
        county: place.county,
        zip: place.zip,
        lat: place.lat + between(-0.02, 0.02),
        lng: place.lng + between(-0.02, 0.02),
        phone: hasPhone ? `${area}-555-01${String(i % 100).padStart(2, "0")}` : null,
        email: hasEmail ? `office@${slug}.example.com` : null,
        website: rnd() < 0.5 ? `https://www.${slug}.example.com` : null,
      },
      contact: hasContact ? { name: `${pick(FIRST)} ${pick(LAST)}`, title: pick(TITLES) } : undefined,
    });
  }

  // 42 projects spread over the first 30 companies, so some companies have several active jobs.
  const projectTypes = Object.keys(PROJECT_DESCRIPTIONS);
  const projectRecords: NormalizedRecord[] = [];
  for (let i = 0; i < 42; i++) {
    const owner = records[(i * 5) % 30];
    const place = PLACES[(i * 3 + 1) % PLACES.length];
    const type = projectTypes[i % projectTypes.length];
    const value = Math.round(between(8, 900) * 1000);
    projectRecords.push({
      company: owner.company,
      project: {
        externalId: `SAMPLE-${place.county === "Broward" ? "B" : "M"}${2026}-${String(10400 + i * 37)}`,
        type,
        description: pick(PROJECT_DESCRIPTIONS[type]),
        address: `${100 + Math.floor(rnd() * 9800)} ${pick(STREETS)}`,
        city: place.city,
        county: place.county,
        zip: place.zip,
        lat: place.lat + between(-0.025, 0.025),
        lng: place.lng + between(-0.025, 0.025),
        declaredValue: value,
        areaSqFt: rnd() < 0.5 ? Math.round(between(600, 24000)) : null,
        issueDate: daysAgo(Math.floor(between(1, 120))),
        estimatedStart: daysAgo(-Math.floor(between(3, 45))),
        status: rnd() < 0.85 ? "Issued" : "Closed",
      },
    });
  }

  // Two deliberate near-duplicates so the merge-review screen has something to show,
  // and one owner-builder record to show the homeowner filter.
  const dupA = records[0].company;
  const dupB = records[5].company;
  const extras: NormalizedRecord[] = [
    { company: { name: dupA.name.replace(/ (LLC|Inc|Corp)$/, "") + " of Florida", phone: dupA.phone ?? "305-555-0190", city: dupA.city, county: dupA.county, zip: dupA.zip, trade: dupA.trade } },
    { company: { name: dupB.name.replace(/ (LLC|Inc|Corp)$/, "s"), city: dupB.city, county: dupB.county, zip: dupB.zip, trade: dupB.trade } },
    { company: { name: "OWNER BUILDER", city: "Kendall", county: "Miami-Dade", zip: "33186" }, project: { externalId: "SAMPLE-M2026-OB1", type: "Driveway", description: "Owner builder: replace residential driveway", city: "Kendall", county: "Miami-Dade", zip: "33186", declaredValue: 9000, issueDate: daysAgo(6), status: "Issued" } },
  ];

  const r1 = await ingestRecords("seed", records);
  const r2 = await ingestRecords("seed", projectRecords);
  const r3 = await ingestRecords("seed", extras);
  await db.project.updateMany({ where: { source: "seed" }, data: { source: "permits" } }).catch(() => undefined);
  console.log(`Sample companies: ${r1.added + r3.added}, projects: ${await db.project.count()}, duplicate pairs for review: ${r1.review + r2.review + r3.review}`);

  // Spread the sample leads over the pipeline with some history.
  const companies = await db.company.findMany({ where: { likelyHomeowner: false }, orderBy: { score: "desc" }, include: { contacts: true } });
  const plan: [string, number][] = [["NEW", 24], ["RESEARCHED", 10], ["CONTACTED", 10], ["CONVERSATION", 7], ["QUOTE_SENT", 5], ["WON", 4], ["LOST", 3]];
  const shuffled = [...companies].sort(() => rnd() - 0.5);
  let idx = 0;
  for (const [stage, count] of plan) {
    for (let k = 0; k < count && idx < shuffled.length; k++, idx++) {
      const c = shuffled[idx];
      const owner = stage === "NEW" ? null : rnd() < 0.7 ? adminId : sales.id;
      const contacted = !["NEW", "RESEARCHED"].includes(stage);
      const last = contacted ? daysAgo(Math.floor(between(1, 30))) : null;
      const quote = ["QUOTE_SENT", "WON", "LOST"].includes(stage) ? Math.round(between(2, 60)) * 500 : null;
      await db.company.update({
        where: { id: c.id },
        data: {
          stage: stage as never,
          ownerId: owner,
          lastContactedAt: last,
          quoteValue: quote,
          wonValue: stage === "WON" ? quote : null,
          lostReason: stage === "LOST" ? pick(["Price", "Uses another supplier", "No current need"]) : null,
        },
      });
      if (contacted && last) {
        await db.activity.create({ data: { companyId: c.id, userId: owner, type: "CALL", outcome: stage === "CONTACTED" ? pick(["Left voicemail", "No answer", "Spoke"]) : "Spoke", body: "Intro call about upcoming jobs.", createdAt: daysAgo(Math.floor(between(31, 45))) } });
        if (["CONVERSATION", "QUOTE_SENT", "WON"].includes(stage)) {
          await db.activity.create({ data: { companyId: c.id, userId: owner, type: "EMAIL", outcome: stage === "CONVERSATION" ? "Interested" : "Requested quote", body: "Sent material list and asked for quantities.", createdAt: last } });
        }
        if (["QUOTE_SENT", "WON", "LOST"].includes(stage)) {
          await db.activity.create({ data: { companyId: c.id, userId: owner, type: "QUOTE", outcome: null, body: `Quote sent for $${quote?.toLocaleString("en-US")}.`, createdAt: last } });
        }
        if (["CONTACTED", "CONVERSATION", "QUOTE_SENT"].includes(stage)) {
          await db.task.create({ data: { companyId: c.id, assigneeId: adminId, title: stage === "QUOTE_SENT" ? "Follow up on quote" : "Follow-up call", dueDate: daysAgo(Math.floor(between(-6, 3))) } });
        }
      }
    }
  }
  // One sample opt-out so the do-not-contact handling is visible.
  const optOut = shuffled[shuffled.length - 1];
  if (optOut) {
    await db.company.update({ where: { id: optOut.id }, data: { doNotContact: true, dncReason: "Asked not to be contacted", dncAt: new Date() } });
    if (optOut.email) await db.suppression.upsert({ where: { kind_value: { kind: "email", value: optOut.email } }, update: {}, create: { kind: "email", value: optOut.email, reason: "Sample opt-out" } });
  }
  await rescoreAll();
}

async function main() {
  await seedConfig();
  const admin = await seedUsers();
  await seedSampleData(admin.id);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
