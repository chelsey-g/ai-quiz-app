"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import type { User } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = [
  {
    href: "/",
    label: "Decks",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h12M6 10h12M6 14h8" />
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "Notes",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    href: "/generate",
    label: "Generate",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/import",
    label: "Import",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 8l-3-3m3 3l3-3" />
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
          const isActive = pathname === href;
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
                      background: "oklch(0.65 0.18 265 / 0.12)",
                      color: "oklch(0.65 0.18 265)",
                      borderLeft: "2px solid oklch(0.65 0.18 265 / 0.7)",
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
        <p className="truncate px-3 text-[11px] text-muted-foreground/50 mb-2">{user.email}</p>
        <div className="flex items-center gap-2">
          <form action={signOut} className="flex-1">
            <button
              type="submit"
              className={buttonVariants({ variant: "outline", size: "sm" }) + " w-full text-xs"}
            >
              Sign out
            </button>
          </form>
          <ThemeToggle />
        </div>
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
