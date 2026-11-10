"use client";

import { useEffect, useState } from "react";

const KEY = "lead-finder:flash";

/**
 * Reloads the current page and shows `message` once it is back.
 * A full reload is used after saves because in-place refreshes were not dependable in production builds.
 */
export function reloadWithFlash(message: string) {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // Private windows may block storage; the reload still shows the saved data.
  }
  window.location.reload();
}

/** Shows the message left by reloadWithFlash, then clears it. Rendered once in the app layout. */
export function Flash() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let stored = "";
    try {
      stored = sessionStorage.getItem(KEY) ?? "";
      sessionStorage.removeItem(KEY);
    } catch {
      return;
    }
    if (!stored) return;
    setMessage(stored);
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, []);
  if (!message) return null;
  return (
    <p role="status" className="fixed bottom-4 left-1/2 z-[1000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg bg-navy-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
      ✓ {message}
    </p>
  );
}
