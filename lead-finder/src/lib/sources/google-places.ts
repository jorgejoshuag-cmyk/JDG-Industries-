import { classifyTrade } from "../classify";
import { fetchJson, politePause } from "./http";
import type { LeadSourceAdapter, NormalizedRecord, PlacesSourceConfig } from "./types";

// Google Places API (New) — Text Search. Only runs when GOOGLE_PLACES_API_KEY is set.
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents", "places.location",
  "places.nationalPhoneNumber", "places.websiteUri", "places.primaryTypeDisplayName", "nextPageToken",
].join(",");

type Place = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
  _query?: string;
};

export const googlePlacesAdapter: LeadSourceAdapter<Place, PlacesSourceConfig> = {
  key: "google_places",
  label: "Business directory (Google Places)",
  description: "Searches Google Places by trade and city. Needs a Google Places API key.",

  notReadyReason(cfg) {
    if (!process.env.GOOGLE_PLACES_API_KEY) return "GOOGLE_PLACES_API_KEY is not set";
    if (!cfg.enabled) return "Turned off";
    if (!cfg.queries.length) return "No searches listed";
    return null;
  },

  async fetch(cfg) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY as string;
    const out: Place[] = [];
    for (const query of cfg.queries.slice(0, 25)) {
      let pageToken: string | undefined;
      for (let page = 0; page < Math.max(1, Math.min(cfg.maxPagesPerQuery || 1, 3)); page++) {
        const body = (await fetchJson(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
          body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
        })) as { places?: Place[]; nextPageToken?: string };
        for (const p of body.places ?? []) out.push({ ...p, _query: query });
        pageToken = body.nextPageToken;
        if (!pageToken) break;
        await politePause();
      }
      await politePause();
    }
    return out;
  },

  normalize(p): NormalizedRecord | null {
    const name = p.displayName?.text?.trim();
    if (!name) return null;
    const part = (type: string, short = false) => {
      const c = p.addressComponents?.find((a) => a.types?.includes(type));
      return (short ? c?.shortText : c?.longText) ?? null;
    };
    const streetNumber = part("street_number");
    const route = part("route", true);
    return {
      company: {
        name,
        trade: classifyTrade(p.primaryTypeDisplayName?.text, name, p._query),
        address: streetNumber && route ? `${streetNumber} ${route}` : (p.formattedAddress ?? null),
        city: part("locality"),
        county: part("administrative_area_level_2"),
        zip: part("postal_code"),
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        phone: p.nationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
      },
    };
  },
};
