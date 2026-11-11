import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";

export type SessionUser = { id: string; name: string; email: string; role: "ADMIN" | "SALES" };

/**
 * Server-side authorization. Call at the top of every page, server action and route handler.
 * Re-reads the user so a deactivated account or a changed role takes effect immediately.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, active: true } });
  if (!user || !user.active) redirect("/login");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
