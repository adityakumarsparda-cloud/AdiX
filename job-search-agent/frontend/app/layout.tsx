import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Search Agent",
  description: "Local-first AI job search, matching and outreach. Human-approved.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="bg-brand text-white">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold">AI Job Search Agent</h1>
            <nav className="text-sm space-x-4 opacity-90">
              <Link href="/">Dashboard</Link>
              <Link href="/outreach">Outreach</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-gray-500">
          Nothing is sent or submitted without your explicit approval.
        </footer>
      </body>
    </html>
  );
}
