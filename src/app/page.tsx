import { Ballot } from "@/components/Ballot";
import { allowlistConfig, auth, signIn, signOut } from "@/lib/auth";
import { TOTAL_ELECTORATE } from "@/config/candidates";

export const dynamic = "force-dynamic";

async function signInAction() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

function SignInCard({ error }: { error?: string }) {
  const config = allowlistConfig();
  const pattern = config.localSuffix
    ? `<name>${config.localSuffix}@${config.domain}`
    : `@${config.domain}`;

  return (
    <div className="card stack">
      {error === "AccessDenied" ? (
        <p className="notice error" style={{ marginBottom: 0 }}>
          That account is not on the voter list. This election is only open to{" "}
          {config.domain ? pattern : "approved"} accounts. Sign out of Google and
          try again with your institute account.
        </p>
      ) : null}
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
        Sign in with your institute Google account to vote. We record only your
        email address, and only to confirm you have voted once — never how you
        voted.
      </p>
      <form action={signInAction}>
        <button className="primary" type="submit">
          Sign in with Google
        </button>
      </form>
      {config.domain ? (
        <p className="footnote" style={{ margin: 0 }}>
          Accounts allowed: {pattern}
        </p>
      ) : null}
    </div>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="page">
      <header className="masthead">
        <h1>Class Representative Election 2026</h1>
        <p>
          Three seats · one ballot each · {TOTAL_ELECTORATE} students on the roll
        </p>
      </header>

      {session?.user?.email ? (
        <Ballot signOutAction={signOutAction} />
      ) : (
        <SignInCard error={error} />
      )}
    </main>
  );
}
