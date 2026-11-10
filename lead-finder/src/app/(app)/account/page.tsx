import { changeOwnPassword } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Your account" subtitle={`${user.name} · ${user.email} · ${user.role === "ADMIN" ? "Admin" : "Sales"}`} />
      <ActionForm action={changeOwnPassword} resetOnSuccess className="card max-w-md space-y-3">
        <h2>Change password</h2>
        <div><label htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
        <div><label htmlFor="next">New password (10+ characters)</label><input id="next" name="next" type="password" autoComplete="new-password" required minLength={10} className="input" /></div>
        <SubmitButton>Change password</SubmitButton>
      </ActionForm>
    </>
  );
}
