import Link from "next/link";
import { completeTask } from "@/app/actions/leads";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, PageHeader, Pagination, fmtDate } from "@/components/ui";
import { PAGE_SIZE } from "@/lib/constants";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; who?: string; page?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "done" ? "done" : "open";
  const who = sp.who === "all" ? "all" : "me";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = { ...(who === "me" ? { assigneeId: user.id } : {}), completedAt: view === "done" ? { not: null } : null };

  const [total, tasks] = await Promise.all([
    db.task.count({ where }),
    db.task.findMany({
      where,
      orderBy: view === "done" ? { completedAt: "desc" } : { dueDate: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { id: true, name: true } }, assignee: { select: { name: true } } },
    }),
  ]);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tab = (label: string, v: string, w: string) => (
    <Link href={`/tasks?view=${v}&who=${w}`} className={view === v && who === w ? "btn btn-sm" : "btn-secondary btn-sm"}>{label}</Link>
  );

  return (
    <>
      <PageHeader title="Tasks" subtitle="Follow-ups and reminders.">
        {tab("My open", "open", "me")}
        {tab("Everyone's open", "open", "all")}
        {tab("My completed", "done", "me")}
      </PageHeader>
      {tasks.length === 0 ? (
        <Empty title={view === "done" ? "No completed tasks" : "No open tasks"}>Tasks are created when you log outreach with a follow-up date, or from a lead&apos;s page.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-navy-100">
            <table className="table">
              <thead><tr><th>Task</th><th>Lead</th><th>Due</th><th className="hidden md:table-cell">Assigned to</th><th /></tr></thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.title}</td>
                    <td><a href={`/leads/${t.company.id}`}>{t.company.name}</a></td>
                    <td className="whitespace-nowrap">{fmtDate(t.dueDate)}{!t.completedAt && t.dueDate < startOfToday ? <strong> · overdue</strong> : ""}</td>
                    <td className="hidden md:table-cell">{t.assignee?.name ?? "Unassigned"}</td>
                    <td className="text-right">
                      <ActionForm action={completeTask}>
                        <input type="hidden" name="id" value={t.id} />
                        {t.completedAt ? <input type="hidden" name="reopen" value="1" /> : null}
                        <SubmitButton className="btn-secondary btn-sm" pendingText="…">{t.completedAt ? "Reopen" : "Done"}</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} params={{ view, who }} basePath="/tasks" />
        </>
      )}
    </>
  );
}
