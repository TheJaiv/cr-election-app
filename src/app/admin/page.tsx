import { AdminPanel } from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · CR Election 2026" };

export default function AdminPage() {
  return (
    <main className="page wide">
      <header className="masthead">
        <h1>Election admin</h1>
        <p>Live turnout, standings, and the voting toggle.</p>
      </header>
      <AdminPanel />
    </main>
  );
}
