"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { reloadWithFlash } from "./flash";
import { useBusy } from "./useBusy";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * A form bound to a server action that shows the action's success or error message.
 * What the user typed is kept when the server returns an error.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  /** Kept for readability at call sites; the page reloads after a successful save, which clears the form. */
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ActionState>({});
  const [busy, run] = useBusy();
  const [leaving, setLeaving] = useState(false);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || leaving) return;
        if (confirm && !window.confirm(confirm)) return;
        // Include the clicked button's name/value, which forms with several submit buttons rely on.
        const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        run(async () => {
          let result: ActionState;
          try {
            result = await action({}, formData);
          } catch {
            result = { error: "Something went wrong. Check your connection and try again." };
          }
          if (result.redirectTo) {
            // Full page load: reliable, and picks up a new sign-in session.
            setLeaving(true);
            window.location.assign(result.redirectTo);
            return;
          }
          if (result.ok) {
            // Reload so the page shows the saved data; the message appears as a notice afterwards.
            setLeaving(true);
            reloadWithFlash(result.ok);
            return;
          }
          setState(result);
        });
      }}
    >
      <PendingContext.Provider value={busy || leaving}>{children}</PendingContext.Provider>
      {state.error ? <p role="alert" className="mt-2 rounded-md border border-black bg-white px-3 py-2 text-sm font-medium text-black">⚠ {state.error}</p> : null}
    </form>
  );
}

export function SubmitButton({ children, className = "btn", pendingText = "Working…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
