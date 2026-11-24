"use client";

import { useSyncExternalStore } from "react";
import { slowRequests } from "@/services/api";

/**
 * Shown while any API request has taken more than a few seconds — typically
 * the free Render server waking up after being idle.
 */
export function SlowServerNotice() {
  const slow = useSyncExternalStore(slowRequests.subscribe, slowRequests.count, () => 0);
  if (slow === 0) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <p className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 shadow-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
        Waking up the FitPal server… this can take up to a minute on the free plan.
      </p>
    </div>
  );
}
