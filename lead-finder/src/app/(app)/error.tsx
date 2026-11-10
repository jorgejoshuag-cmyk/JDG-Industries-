"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto mt-10 max-w-lg text-center">
      <h1>Something went wrong</h1>
      <p className="muted mt-2">This page could not be loaded. Your data has not been changed.</p>
      {error.digest ? <p className="muted mt-1">Reference: {error.digest}</p> : null}
      <button type="button" className="btn mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
