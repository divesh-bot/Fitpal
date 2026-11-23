"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { appUrl, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AuthCard, FormError, FormNotice } from "@/features/auth/AuthCard";
import { friendlyAuthError, useRedirectIfSignedIn } from "@/features/auth/useRedirectIfSignedIn";
import { validatePassword } from "@/features/auth/password";

export default function SignupPage() {
  useRedirectIfSignedIn();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pwProblem = validatePassword(password);
    if (pwProblem) return setError(pwProblem);
    if (password !== confirm) return setError("Passwords don't match.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");

    setBusy(true);
    const { error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: appUrl("/auth/callback/"),
        data: { display_name: name.trim().slice(0, 80) || undefined },
      },
    });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message));
    // Same message whether or not the address already has an account (prevents account discovery).
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        footer={
          <Link href="/login/" className="font-semibold text-emerald-700 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <FormNotice>
          We sent a confirmation link to <strong>{email.trim()}</strong>. Open it <strong>in this browser</strong> to
          finish creating your account.
        </FormNotice>
        <p className="text-xs text-slate-500">
          Opened it on another device? Your email is still confirmed. Just come back here and sign in. No email after a
          few minutes? Check spam.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Your data is private to you and syncs across your devices."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login/" className="font-semibold text-emerald-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <Field
          label="Your name (optional)"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 10 characters, with letters and a number."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" className="w-full" loading={busy} disabled={!email || !password || !confirm}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
