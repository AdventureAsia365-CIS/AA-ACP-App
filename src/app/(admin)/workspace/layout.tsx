"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/workspace/pipeline", label: "Pipeline" },
  { href: "/workspace/s0/review", label: "S0 Review" },
  { href: "/workspace/s1/run", label: "S1 Rewrite" },
  { href: "/workspace/s3/review", label: "S3 Campaign" },
  { href: "/workspace/catalog", label: "Catalog" },
  { href: "/workspace/brand", label: "Brand Brief" },
];

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-aa-offwhite">
      <aside className="w-56 shrink-0 bg-aa-blackblue text-white flex flex-col">
        <div className="px-4 py-5 border-b border-white/10">
          <span className="text-xs font-bold tracking-widest text-white/40 uppercase">Admin</span>
          <p className="text-sm font-semibold text-white mt-0.5">Workspace</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  active ? "bg-aa-orange text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
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
