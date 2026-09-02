import { AdminPanel } from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · CR Election 2026" };

export default function AdminPage() {
  return (
    <main className="page">
      <header className="masthead">
        <h1>Election admin</h1>
        <p>Turnout, voting toggle, and the sealed tally.</p>
      </header>
      <AdminPanel />
    </main>
  );
}
