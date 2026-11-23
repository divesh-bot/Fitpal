/**
 * Client-side password rule (Supabase also enforces its own minimum on the
 * server). Returns an error message, or null if acceptable.
 */
export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 72) return "Use at most 72 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number.";
  return null;
}
