// Every lead source produces NormalizedRecord objects, which lib/ingest.ts writes to the database.

export type NormalizedRecord = {
  company: {
    name: string;
    trade?: string | null;
    licenseNumber?: string | null;
    address?: string | null;
    city?: string | null;
    county?: string | null;
    zip?: string | null;
    lat?: number | null;
    lng?: number | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  contact?: { name: string; title?: string | null; phone?: string | null; email?: string | null };
  project?: {
    externalId: string;
    type?: string | null;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    county?: string | null;
    zip?: string | null;
    lat?: number | null;
    lng?: number | null;
    declaredValue?: number | null;
    areaSqFt?: number | null;
    issueDate?: Date | null;
    estimatedStart?: Date | null;
    status?: string | null;
  };
};

/** Settings for a JSON open-data source. Edited in Admin → Sources, defaults in sources/config.ts. */
export type JsonSourceConfig = {
  kind: "json";
  enabled: boolean;
  /**
   * HTTPS endpoint returning JSON. May contain {limit} and {offset} placeholders for paging,
   * e.g. https://data.example.gov/resource/abcd-1234.json?$limit={limit}&$offset={offset}
   */
  url: string;
  /** Extra request headers, e.g. an app token. Never put secrets you would not want an admin to see. */
  headers: Record<string, string>;
  /** Dot path to the array of records in the response. Empty string when the response is the array. */
  recordsPath: string;
  /** Our field name → dot path of the value inside one source record. */
  fieldMap: Record<string, string>;
  pageSize: number;
  maxPages: number;
  /** Used when the source has no trade / project type column. Empty = classify from text. */
  defaultTrade: string;
  defaultProjectType: string;
  /** Set when every record in this source is in one county. */
  defaultCounty: string;
};

export type PlacesSourceConfig = {
  kind: "places";
  enabled: boolean;
  /** Text searches, e.g. "concrete contractor in Hialeah, FL". One API call per page per query. */
  queries: string[];
  maxPagesPerQuery: number;
};

export type SourceConfig = JsonSourceConfig | PlacesSourceConfig;

export interface LeadSourceAdapter<Raw = unknown, Cfg = SourceConfig> {
  key: string;
  label: string;
  description: string;
  /** Returns a human-readable reason when the source cannot run yet, or null when it is ready. */
  notReadyReason(config: Cfg): string | null;
  fetch(config: Cfg): Promise<Raw[]>;
  normalize(raw: Raw, config: Cfg): NormalizedRecord | null;
}
