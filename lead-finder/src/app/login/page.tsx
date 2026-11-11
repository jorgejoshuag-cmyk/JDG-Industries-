import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { login } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-navy-600">JDG Aggregates</p>
        <h1 className="mt-1">Lead Finder</h1>
        <p className="muted mt-1">Internal tool. Sign in to continue.</p>
        <ActionForm action={login} className="mt-5 space-y-4">
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input" />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn w-full" pendingText="Signing in…">Sign in</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
