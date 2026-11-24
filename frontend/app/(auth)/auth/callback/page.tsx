"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/Feedback";
import { AuthCard } from "@/features/auth/AuthCard";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * Landing page for the sign-up confirmation email. The Supabase client
 * exchanges the one-time code in the URL for a session automatically.
 */
export default function AuthCallbackPage() {
  const { state } = useAuth();
  const router = useRouter();
  // Supabase reports link problems (expired, already used) in the URL. Read once
  // on first render; the pre-built HTML only ever shows the loading state.
  const [linkError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, "&"));
    return params.get("error_description")?.replace(/\+/g, " ") ?? null;
  });

  useEffect(() => {
    if (state.status === "signedIn") router.replace("/today/");
  }, [state.status, router]);

  if (state.status !== "signedOut") return <LoadingBlock label="Finishing sign-in…" />;

  return (
    <AuthCard
      title={linkError ? "Link problem" : "Email confirmed?"}
      footer={
        <Link prefetch={false} href="/login/" className="font-semibold text-emerald-700 hover:underline">
          Go to sign in
        </Link>
      }
    >
      <p className="text-sm text-slate-600">
        {linkError
          ? `${linkError}. Confirmation links can only be used once.`
          : "If you opened the confirmation link in a different browser or device, your email is confirmed. Just sign in with your email and password."}
      </p>
    </AuthCard>
  );
}
