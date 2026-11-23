"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LoadingBlock } from "@/components/ui/Feedback";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * Everything under (app) requires a signed-in user. This is a convenience
 * redirect only: the API itself rejects any request without a valid token,
 * so no data is ever served to a signed-out visitor.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "signedOut") router.replace("/login/");
  }, [state.status, router]);

  if (state.status !== "signedIn") return <LoadingBlock label="Loading FitPal…" />;
  return <AppShell>{children}</AppShell>;
}
