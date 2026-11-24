"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { appUrl, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AuthCard, FormError, FormNotice } from "@/features/auth/AuthCard";
import { friendlyAuthError } from "@/features/auth/useRedirectIfSignedIn";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl("/reset-password/"),
    });
    setBusy(false);
    // Only surface rate-limit/network problems; never reveal whether the account exists.
    if (error && /rate|network|fetch/i.test(error.message)) return setError(friendlyAuthError(error.message));
    setSent(true);
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to choose a new password."
      footer={
        <Link prefetch={false} href="/login/" className="font-semibold text-emerald-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <FormNotice>
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Open it{" "}
          <strong>in this browser</strong>.
        </FormNotice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormError message={error} />
          <Button type="submit" className="w-full" loading={busy} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
