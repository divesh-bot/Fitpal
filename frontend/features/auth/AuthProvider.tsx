"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; session: Session };

interface AuthContextValue {
  state: AuthState;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Tracks the Supabase session. Starts as "loading" (identical in the pre-built
 * HTML and the first browser render), then resolves in the browser.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const queryClient = useQueryClient();

  useEffect(() => {
    const auth = supabase().auth;
    let active = true;

    auth.getSession().then(({ data }) => {
      if (active) setState(data.session ? { status: "signedIn", session: data.session } : { status: "signedOut" });
    });

    const { data: sub } = auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        // Never show one user's cached data to the next person on this device.
        queryClient.clear();
      }
      setState(session ? { status: "signedIn", session } : { status: "signedOut" });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signOut: async () => {
        await supabase().auth.signOut();
        queryClient.clear();
      },
    }),
    [state, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
