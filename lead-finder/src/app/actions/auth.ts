"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { fail, goTo, type ActionState } from "@/lib/action-state";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", { email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? ""), redirect: false });
  } catch (e) {
    // Same message for a wrong password, unknown email, disabled account and rate limit.
    if (e instanceof AuthError) return fail("Sign-in failed. Check your email and password, or wait 15 minutes if you have tried several times.");
    throw e;
  }
  return goTo("/");
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
