"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "success" | "warning" | "neutral" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

const TONES: Record<Tone, string> = {
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-600 text-white",
  neutral: "bg-slate-800 text-white",
  error: "bg-rose-600 text-white",
};

/**
 * Prototype-style toasts (top-right). Only call this AFTER the API confirms
 * success, never optimistically.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 5000 : 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto max-w-xs rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg ${TONES[t.tone]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
