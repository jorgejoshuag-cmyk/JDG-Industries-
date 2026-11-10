export const STAGES = ["NEW", "RESEARCHED", "CONTACTED", "CONVERSATION", "QUOTE_SENT", "WON", "LOST"] as const;
export type StageKey = (typeof STAGES)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  NEW: "New",
  RESEARCHED: "Researched",
  CONTACTED: "Contacted",
  CONVERSATION: "Conversation",
  QUOTE_SENT: "Quote Sent",
  WON: "Won",
  LOST: "Lost",
};

export const TRADES = [
  "Concrete Contractor",
  "General Contractor",
  "Site Work / Excavation",
  "Paving / Driveway",
  "Paver Installer",
  "Pool Builder",
  "Landscaper",
  "Masonry / Foundation",
  "Septic / Drainfield",
  "Plumbing (Underground)",
  "Developer",
  "Home Builder",
  "Property Manager",
  "Municipal / Public Works",
  "Other",
] as const;

export const PROJECT_TYPES = [
  "New Construction",
  "Foundation / Slab",
  "Driveway",
  "Paving",
  "Pool",
  "Site Work",
  "Demolition",
  "Public Bid",
  "Other",
] as const;

export const COUNTIES = ["Miami-Dade", "Broward"] as const;

export const TIERS = ["Hot", "Warm", "Cold"] as const;

export const ACTIVITY_TYPES = ["CALL", "EMAIL", "TEXT", "NOTE", "MEETING", "QUOTE"] as const;

export const ACTIVITY_LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  CALL: "Call",
  EMAIL: "Email",
  TEXT: "Text",
  NOTE: "Note",
  MEETING: "Meeting",
  QUOTE: "Quote sent",
};

export const OUTCOMES = [
  "No answer",
  "Left voicemail",
  "Spoke",
  "Interested",
  "Requested quote",
  "Not interested",
  "Wrong number",
  "Opted out",
] as const;

export const LOST_REASONS = ["Price", "Uses another supplier", "No current need", "Outside service area", "No response", "Other"] as const;

export const PAGE_SIZE = 25;

export const MERGE_FIELDS = [
  "company_name",
  "contact_name",
  "project_type",
  "jobsite_city",
  "material_suggestions",
  "sender_name",
  "our_company",
] as const;
