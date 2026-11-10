import { createUser, updateUser } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Users" subtitle="Admins can change settings and see logs. Sales users work leads." />
      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id} className="card">
            <ActionForm action={updateUser} className="grid items-end gap-3 sm:grid-cols-5">
              <input type="hidden" name="id" value={u.id} />
              <div className="sm:col-span-2">
                <p className="font-semibold text-navy-900">{u.name}{u.id === admin.id ? " (you)" : ""}</p>
                <p className="muted break-all">{u.email} · added {fmtDate(u.createdAt)}</p>
              </div>
              <div><label htmlFor={`role-${u.id}`}>Role</label><select id={`role-${u.id}`} name="role" defaultValue={u.role} className="input"><option value="SALES">Sales</option><option value="ADMIN">Admin</option></select></div>
              <div><label htmlFor={`active-${u.id}`}>Status</label><select id={`active-${u.id}`} name="active" defaultValue={u.active ? "1" : "0"} className="input"><option value="1">Active</option><option value="0">Disabled</option></select></div>
              <div><label htmlFor={`pw-${u.id}`}>Reset password</label><input id={`pw-${u.id}`} name="newPassword" type="password" autoComplete="new-password" placeholder="Leave blank to keep" className="input" /></div>
              <div className="sm:col-span-5"><SubmitButton className="btn-secondary btn-sm">Save {u.name.split(" ")[0]}</SubmitButton></div>
            </ActionForm>
          </li>
        ))}
      </ul>
      <ActionForm action={createUser} resetOnSuccess className="card mt-6 max-w-2xl">
        <h2 className="mb-3">Add a user</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="n-name">Name</label><input id="n-name" name="name" required maxLength={80} className="input" /></div>
          <div><label htmlFor="n-email">Email</label><input id="n-email" name="email" type="email" required maxLength={200} className="input" /></div>
          <div><label htmlFor="n-role">Role</label><select id="n-role" name="role" className="input"><option value="SALES">Sales</option><option value="ADMIN">Admin</option></select></div>
          <div><label htmlFor="n-pw">Starting password (10+ characters)</label><input id="n-pw" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" /></div>
        </div>
        <div className="mt-3"><SubmitButton>Add user</SubmitButton></div>
      </ActionForm>
    </>
  );
}
