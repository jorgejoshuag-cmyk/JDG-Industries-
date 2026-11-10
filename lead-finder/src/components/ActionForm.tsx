"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
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
  resetOnSuccess = false,
  confirm,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const router = useRouter();
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
          setState(result);
          if (result.ok) {
            if (resetOnSuccess) ref.current?.reset();
            // Actions only save; the page is re-fetched here so it shows the new data.
            router.refresh();
          }
        });
      }}
    >
      <PendingContext.Provider value={busy || leaving}>{children}</PendingContext.Provider>
      {state.error ? <p role="alert" className="mt-2 rounded-md border border-black bg-white px-3 py-2 text-sm font-medium text-black">⚠ {state.error}</p> : null}
      {state.ok ? <p role="status" className="mt-2 text-sm font-medium text-navy-600">✓ {state.ok}</p> : null}
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
