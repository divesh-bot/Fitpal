"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { LoadingBlock } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { AuthCard, FormError } from "@/features/auth/AuthCard";
import { useAuth } from "@/features/auth/AuthProvider";
import { validatePassword } from "@/features/auth/password";
import { friendlyAuthError } from "@/features/auth/useRedirectIfSignedIn";

/**
 * Landing page for the password-reset email. Supabase exchanges the one-time
 * code in the URL for a short recovery session, which allows setting a new password.
 */
export default function ResetPasswordPage() {
  const { state } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "loading") return <LoadingBlock label="Checking your reset link…" />;

  if (state.status === "signedOut") {
    return (
      <AuthCard
        title="Link expired or invalid"
        footer={
          <Link prefetch={false} href="/forgot-password/" className="font-semibold text-emerald-700 hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-slate-600">
          Reset links work once, for a limited time, and only in the browser where you requested them. Please request a
          new one.
        </p>
      </AuthCard>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = validatePassword(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));
    toast("Password updated");
    router.replace("/today/");
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters, with letters and a number."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" className="w-full" loading={busy} disabled={!password || !confirm}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
