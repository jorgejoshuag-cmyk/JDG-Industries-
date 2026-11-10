import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";

const credentialsSchema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // A wrong password is expected, not a server fault: keep it out of the error log.
    error(error) {
      if ((error as { type?: string }).type !== "CredentialsSignin") console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();
        const ip = request.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const since = new Date(Date.now() - WINDOW_MS);

        // Rate limit per email and per IP address.
        const keys = [`email:${email}`, `ip:${ip}`];
        const failures = await db.loginAttempt.groupBy({
          by: ["key"],
          where: { key: { in: keys }, success: false, createdAt: { gte: since } },
          _count: true,
        });
        if (failures.some((f) => f._count >= (f.key.startsWith("ip:") ? MAX_FAILURES * 4 : MAX_FAILURES))) return null;

        const user = await db.user.findUnique({ where: { email } });
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        const success = Boolean(user && user.active && ok);
        await db.loginAttempt.createMany({ data: keys.map((key) => ({ key, success })) });
        if (!success || !user) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
