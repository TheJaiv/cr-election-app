/**
 * NextAuth (Auth.js v5) configuration — Google provider only.
 *
 * Privacy: we keep the email and nothing else. `name`, `picture` and every
 * other profile field are dropped in the `profile` callback before they reach
 * the JWT, so no display name or avatar ever exists in a cookie or a bundle.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { checkAllowlist, normaliseEmail } from "@/lib/allowlist";
import { env } from "@/lib/env";

export function allowlistConfig() {
  return {
    domain: env.allowedEmailDomain,
    localSuffix: env.allowedEmailLocalSuffix,
    emails: env.allowedEmails,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 4 },
  pages: { signIn: "/", error: "/" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Only the email scope. No profile, so no name and no picture.
          scope: "openid email",
          prompt: "select_account",
          ...(process.env.ALLOWED_EMAIL_DOMAIN
            ? { hd: process.env.ALLOWED_EMAIL_DOMAIN }
            : {}),
        },
      },
      // Strip everything except the email before it is persisted anywhere.
      profile(profile) {
        return { id: profile.sub, email: profile.email ?? null };
      },
    }),
  ],
  callbacks: {
    signIn({ profile, user }) {
      const email = normaliseEmail(profile?.email ?? user?.email);
      return checkAllowlist(email, allowlistConfig()).allowed;
    },
    jwt({ token, user }) {
      if (user?.email) token.email = user.email.toLowerCase();
      // Belt and braces: never carry these, even if a future provider sets them.
      delete token.name;
      delete token.picture;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string | undefined) ?? "";
        session.user.name = null as unknown as string;
        session.user.image = null;
      }
      return session;
    },
  },
});

/**
 * Resolve the signed-in, allowlisted email for an API route. Returns null when
 * there is no valid session — routes must never read an email from the body.
 */
export async function requireVoterEmail(): Promise<string | null> {
  const session = await auth();
  const email = normaliseEmail(session?.user?.email);
  if (!email) return null;
  // Re-check the allowlist on every request so revoking access takes effect
  // immediately instead of at token expiry.
  return checkAllowlist(email, allowlistConfig()).allowed ? email : null;
}
