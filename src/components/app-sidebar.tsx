"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/create",
    label: "Create",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: "/collections",
    label: "Collections",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25" />
      </svg>
    ),
  },
  {
    href: "/challenges",
    label: "Challenges",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: "/kata",
    label: "Kata",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    href: "/community",
    label: "Community",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
] as const;

function SidebarContent({
  user,
  onNavClick,
}: {
  user: User;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-2 py-1 group mb-6" onClick={onNavClick}>
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/25 bg-primary/12 transition-all duration-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:shadow-[0_0_10px_oklch(0.77_0.195_68_/_0.20)]">
          <svg
            className="text-primary w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
          </svg>
        </div>
        <span className="font-heading text-sm font-bold tracking-tight text-foreground">Quizly</span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={
                isActive
                  ? "flex items-center gap-3 rounded-lg py-2 pr-3 text-sm font-medium transition-all duration-150"
                  : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/80 transition-all duration-150 hover:bg-muted/40 hover:text-foreground"
              }
              style={
                isActive
                  ? {
                      background:
                        "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)",
                      color: "var(--dashboard-accent-teal-strong)",
                      borderLeft:
                        "2px solid color-mix(in oklch, var(--dashboard-accent-teal) 72%, transparent)",
                      paddingLeft: "10px",
                    }
                  : undefined
              }
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User info + sign out */}
      <div className="border-t border-border/40 pt-3 mt-3">
        <Link
          href="/profile"
          onClick={onNavClick}
          className="truncate block px-3 text-[11px] text-muted-foreground/50 mb-2 hover:text-muted-foreground transition-colors"
        >
          {user.email}
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full text-xs"}
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

export function AppSidebar({ user }: { user: User }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden md:flex h-screen w-56 flex-none flex-col border-r border-border/50 bg-card/40 px-3 py-4">
        <SidebarContent user={user} />
      </aside>

      {/* Mobile hamburger button — only visible below md */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-card/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-muted/60 hover:text-foreground"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile overlay + sidebar */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Slide-in sidebar */}
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/50 bg-card/95 px-3 py-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                Menu
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent user={user} onNavClick={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
