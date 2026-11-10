import { logout } from "@/app/actions/auth";
import { Nav } from "@/components/Nav";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const [tasksDue, duplicates] = await Promise.all([
    db.task.count({ where: { assigneeId: user.id, completedAt: null, dueDate: { lte: endOfToday } } }),
    db.duplicateCandidate.count({ where: { status: "PENDING" } }),
  ]);
  const items = [
    { href: "/", label: "Today" },
    { href: "/leads", label: "Leads" },
    { href: "/pipeline", label: "Pipeline" },
    { href: "/tasks", label: "Tasks", badge: tasksDue },
    { href: "/import", label: "Import" },
    { href: "/duplicates", label: "Duplicates", badge: duplicates },
    { href: "/reports", label: "Reports" },
  ];
  const adminItems =
    user.role === "ADMIN"
      ? [
          { href: "/admin/sources", label: "Sources" },
          { href: "/admin/scoring", label: "Scoring" },
          { href: "/admin/templates", label: "Templates" },
          { href: "/admin/materials", label: "Material estimates" },
          { href: "/admin/settings", label: "Settings" },
          { href: "/admin/users", label: "Users" },
          { href: "/admin/logs", label: "Logs" },
        ]
      : [];
  return (
    <div className="min-h-screen">
      <Nav items={items} adminItems={adminItems} userName={user.name} logout={logout} />
      <main className="px-4 py-5 md:ml-56 md:px-8 md:py-7">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
