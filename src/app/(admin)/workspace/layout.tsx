"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { getAdminSecret } from "@/lib/admin-auth";

const NAV = [
  { href: "/workspace/pipeline",    label: "All Runs" },
  { href: "/workspace/pipeline/s0", label: "S0 Upload" },
  { href: "/workspace/pipeline/s1", label: "S1 Rewrite" },
  { href: "/workspace/pipeline/s2", label: "S2 Research" },
  { href: "/workspace/pipeline/s3", label: "S3 Campaign" },
  { href: "/workspace/pipeline/s4", label: "S4 Publish" },
  { href: "/workspace/s0/review",   label: "S0 Queue" },
  { href: "/workspace/catalog",     label: "Catalog" },
  { href: "/workspace/brand",       label: "Brand Brief" },
  { href: "/workspace/social",      label: "Social Review" },
  { href: "/workspace/s4/blog",     label: "S4 Blog" },
  { href: "/workspace/rules",       label: "Rules" },
];

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!getAdminSecret()) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    Sentry.setContext("acp_session", {
      area: "admin-workspace",
      stage: segments[2] || segments[1] || null,
      path: pathname,
    });
  }, [pathname]);

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
