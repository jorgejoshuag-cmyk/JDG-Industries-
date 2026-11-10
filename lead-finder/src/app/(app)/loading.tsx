export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 animate-pulse rounded bg-navy-100" />
      <div className="h-24 animate-pulse rounded-lg bg-navy-50" />
      <div className="h-64 animate-pulse rounded-lg bg-navy-50" />
    </div>
  );
}
