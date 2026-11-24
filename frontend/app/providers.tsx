"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/services/api";
import { SlowServerNotice } from "@/components/SlowServerNotice";
import { env } from "@/lib/env";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Coming back to the tab refetches, so data logged on another device appears.
        refetchOnWindowFocus: true,
        // Don't retry client errors (validation, not found, auth); retry network/server errors twice.
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  // Wake the API early (free hosting sleeps when idle) while the user is still signing in.
  useEffect(() => {
    fetch(`${env.apiBaseUrl}/health`, { cache: "no-store" }).catch(() => {});
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            {children}
            <SlowServerNotice />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
