/**
 * Who is allowed to sign in.
 *
 * A voter is allowed if their email is on the explicit ALLOWED_EMAILS list, or
 * if it matches ALLOWED_EMAIL_DOMAIN (optionally further narrowed by
 * ALLOWED_EMAIL_LOCAL_SUFFIX). At least one of the two mechanisms must be
 * configured — an unconfigured allowlist denies everyone rather than
 * accidentally opening the election to the whole internet.
 */

export interface AllowlistConfig {
  domain: string;
  localSuffix: string;
  emails: readonly string[];
}

export type AllowlistResult =
  | { allowed: true; email: string }
  | { allowed: false; reason: "NOT_CONFIGURED" | "NO_EMAIL" | "NOT_ALLOWED" };

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  // Deliberately strict: exactly one "@", no whitespace, a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function checkAllowlist(
  rawEmail: unknown,
  config: AllowlistConfig,
): AllowlistResult {
  const email = normaliseEmail(rawEmail);
  if (!email) return { allowed: false, reason: "NO_EMAIL" };

  const hasDomainRule = config.domain.length > 0;
  const hasListRule = config.emails.length > 0;
  if (!hasDomainRule && !hasListRule) {
    return { allowed: false, reason: "NOT_CONFIGURED" };
  }

  if (hasListRule && config.emails.includes(email)) {
    return { allowed: true, email };
  }

  if (hasDomainRule) {
    const atIndex = email.lastIndexOf("@");
    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    const domainMatches = domain === config.domain;
    const suffixMatches =
      config.localSuffix.length === 0 || localPart.endsWith(config.localSuffix);
    if (domainMatches && suffixMatches) {
      return { allowed: true, email };
    }
  }

  return { allowed: false, reason: "NOT_ALLOWED" };
}

export function allowlistMessage(
  reason: Exclude<AllowlistResult, { allowed: true }>["reason"],
  config: AllowlistConfig,
): string {
  switch (reason) {
    case "NOT_CONFIGURED":
      return "Sign-in is not configured yet. Contact the election administrator.";
    case "NO_EMAIL":
      return "Google did not return a usable email address.";
    case "NOT_ALLOWED": {
      const pattern = config.localSuffix
        ? `*${config.localSuffix}@${config.domain}`
        : `*@${config.domain}`;
      return config.domain
        ? `This election is only open to ${pattern} accounts. Sign in with your institute account.`
        : "This account is not on the approved voter list.";
    }
  }
}
