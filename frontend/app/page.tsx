"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/Feedback";
import { useAuth } from "@/features/auth/AuthProvider";

/** Entry point: send the visitor to Today or to sign in. */
export default function Home() {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "signedIn") router.replace("/today/");
    if (state.status === "signedOut") router.replace("/login/");
  }, [state.status, router]);
  return <LoadingBlock label="Loading FitPal…" />;
}
