"use client";

import { useEffect, useState } from "react";
import { env } from "@/lib/env";

type Status = { kind: "checking" } | { kind: "ok"; version: string } | { kind: "error"; message: string };

/** Calls GET /health on the backend and shows the result. */
export function BackendStatus() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    fetch(`${env.apiBaseUrl}/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Backend responded with HTTP ${res.status}`);
        const body = (await res.json()) as { data?: { version?: string } };
        setStatus({ kind: "ok", version: body.data?.version ?? "unknown" });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "Timed out after 10 s"
            : err instanceof Error
              ? err.message
              : "Unknown error";
        setStatus({ kind: "error", message });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const base = "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium";

  if (status.kind === "checking") {
    return (
      <p role="status" className={`${base} border-slate-200 bg-slate-50 text-slate-600`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" /> Checking backend…
      </p>
    );
  }
  if (status.kind === "ok") {
    return (
      <p role="status" className={`${base} border-emerald-200 bg-emerald-50 text-emerald-800`}>
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Backend reachable (API v{status.version})
      </p>
    );
  }
  return (
    <p role="alert" className={`${base} border-amber-200 bg-amber-50 text-amber-800`}>
      <span className="h-2 w-2 rounded-full bg-amber-500" /> Backend not reachable: {status.message}
    </p>
  );
}
