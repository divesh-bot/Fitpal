"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AuthCard, FormError } from "@/features/auth/AuthCard";
import { friendlyAuthError, useRedirectIfSignedIn } from "@/features/auth/useRedirectIfSignedIn";

export default function LoginPage() {
  useRedirectIfSignedIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }
    router.replace("/today/");
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Track your calories, protein, meals and workouts."
      footer={
        <>
          New here?{" "}
          <Link prefetch={false} href="/signup/" className="font-semibold text-emerald-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" className="w-full" loading={busy} disabled={!email || !password}>
          Sign in
        </Button>
      </form>
      <Link
        prefetch={false}
        href="/forgot-password/"
        className="block text-center text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        Forgot your password?
      </Link>
    </AuthCard>
  );
}
