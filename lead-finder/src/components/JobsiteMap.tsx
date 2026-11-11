"use client";

import { useEffect, useRef } from "react";

export type MapPoint = { lat: number; lng: number; label: string; kind: "office" | "jobsite" | "yard" };

/** Map of the company's office and jobsites. Map tiles © OpenStreetMap contributors. */
export function JobsiteMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      const style = { office: { color: "#000000", fill: "#ffffff" }, jobsite: { color: "#10213f", fill: "#1f3a68" }, yard: { color: "#10213f", fill: "#ffffff" } };
      for (const p of points) {
        L.circleMarker([p.lat, p.lng], { radius: p.kind === "jobsite" ? 8 : 7, color: style[p.kind].color, fillColor: style[p.kind].fill, fillOpacity: 0.9, weight: 2 })
          .addTo(map)
          .bindTooltip(p.label);
      }
      if (points.length === 1) map.setView([points[0].lat, points[0].lng], 12);
      else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24], maxZoom: 13 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return (
    <div>
      <div ref={ref} className="h-64 w-full rounded-lg border border-navy-100" role="img" aria-label="Map of office and jobsite locations" />
      <p className="muted mt-1">● filled navy = jobsite · ○ black ring = office · ○ navy ring = our yard</p>
    </div>
  );
}
