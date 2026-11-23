/**
 * Public (browser-safe) configuration.
 *
 * Only variables prefixed with NEXT_PUBLIC_ are embedded into the browser
 * bundle — at BUILD time. Never put secrets (Supabase secret/service-role keys,
 * DB passwords) in a NEXT_PUBLIC_ variable: anyone can read them in the browser.
 *
 * Each variable must be referenced literally (process.env.NEXT_PUBLIC_X) so
 * Next.js can inline it during the build.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Copy frontend/.env.example to frontend/.env.local and fill it in.`,
    );
  }
  return value.trim();
}

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const env = {
  /** Base URL of the Express API, e.g. http://localhost:4000 */
  apiBaseUrl: stripTrailingSlash(required("NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL)),
  supabaseUrl: stripTrailingSlash(required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)),
  /** Publishable (public) key — identifies the project; safe in the browser. */
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;
