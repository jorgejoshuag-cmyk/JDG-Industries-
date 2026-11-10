import { db } from "./db";

export const SETTING_DEFAULTS: Record<string, string> = {
  company_name: "JDG Aggregates",
  business_address: "",
  yard_address: "",
  yard_lat: "",
  yard_lng: "",
  service_counties: "Miami-Dade,Broward",
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export function yardCoords(s: Record<string, string>): { lat: number; lng: number } | null {
  const lat = Number(s.yard_lat);
  const lng = Number(s.yard_lng);
  if (!s.yard_lat || !s.yard_lng || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function serviceCounties(s: Record<string, string>): string[] {
  return s.service_counties.split(",").map((c) => c.trim()).filter(Boolean);
}
