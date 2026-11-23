"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

/** Sends an already signed-in user from the login/sign-up pages to the app. */
export function useRedirectIfSignedIn(to = "/today/") {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "signedIn") router.replace(to);
  }, [state.status, router, to]);
  return state.status;
}

/** Maps Supabase Auth error messages to friendlier text. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first. Check your inbox for the confirmation link.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a few minutes and try again.";
  if (m.includes("password should be")) return message;
  if (m.includes("network") || m.includes("fetch")) return "Can't reach the sign-in service. Check your connection.";
  return message;
}
