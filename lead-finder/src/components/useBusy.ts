"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Tracks whether an async server call is in flight, using plain state.
 * (React transitions are deliberately not used here: a server action that also revalidates the page
 * could leave a transition pending, and the button stuck on "Working…".)
 */
export function useBusy(): [boolean, (work: () => Promise<void>) => void] {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback((work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    work()
      .catch((e) => console.error(e))
      .finally(() => {
        running.current = false;
        setBusy(false);
      });
  }, []);
  return [busy, run];
}
