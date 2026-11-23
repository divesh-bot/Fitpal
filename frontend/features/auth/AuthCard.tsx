import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";

/** Centered card used by all sign-in related pages. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center gap-3">
        <LogoMark />
        <div>
          <p className="text-base leading-tight font-bold tracking-tight text-slate-900">FitPal</p>
          <p className="text-xs text-slate-500">Fat Loss + Muscle Plan</p>
        </div>
      </div>
      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </section>
      {footer && <div className="mt-4 text-center text-sm text-slate-500">{footer}</div>}
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
    >
      {message}
    </p>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
    >
      {children}
    </div>
  );
}
