/**
 * Server-only environment access.
 *
 * Nothing in this file may be imported from a client component — none of these
 * names are NEXT_PUBLIC_, so importing it into the browser bundle would fail the
 * build rather than leak, but keep it server-side regardless.
 */
import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  get googleSheetId() {
    return required("GOOGLE_SHEET_ID");
  },
  get serviceAccountEmail() {
    return required("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  },
  /**
   * The PEM body. Vercel's env editor stores newlines as the two characters
   * `\` + `n`, so normalise both forms.
   */
  get servicePrivateKey() {
    return required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  },
  get allowedEmailDomain() {
    return optional("ALLOWED_EMAIL_DOMAIN").toLowerCase();
  },
  /**
   * Optional extra constraint on the local part, e.g. ".cse26" so that only
   * <something>.cse26@<domain> can sign in. Empty means "any local part".
   */
  get allowedEmailLocalSuffix() {
    return optional("ALLOWED_EMAIL_LOCAL_SUFFIX").toLowerCase();
  },
  get allowedEmails() {
    return optional("ALLOWED_EMAILS")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  get adminPasswordHash() {
    return required("ADMIN_PASSWORD_HASH");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
} as const;
