export type ActionState = {
  error?: string;
  ok?: string;
  /**
   * Where the browser should go next. Returned instead of calling redirect() inside the action:
   * the form then does a full page load, which is reliable and also picks up a new sign-in session.
   */
  redirectTo?: string;
};
export const fail = (error: string): ActionState => ({ error });
export const done = (ok = "Saved."): ActionState => ({ ok });

/** First readable message from a zod error. */
export function zodMessage(e: { issues: { path: (string | number)[]; message: string }[] }): string {
  const i = e.issues[0];
  return i ? `${i.path.join(".") || "Input"}: ${i.message}` : "Invalid input.";
}
export const goTo = (redirectTo: string): ActionState => ({ redirectTo });
