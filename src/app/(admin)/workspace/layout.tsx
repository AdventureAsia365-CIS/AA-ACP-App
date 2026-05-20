"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/workspace/s0/review", label: "S0 Review" },
  { href: "/workspace/s1/run", label: "S1 Rewrite" },
  { href: "/workspace/catalog", label: "Catalog" },
];

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 shrink-0 bg-slate-900 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-slate-700">
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Admin</span>
          <p className="text-sm font-semibold text-white mt-0.5">Workspace</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
