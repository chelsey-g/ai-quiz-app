import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quizly",
  description: "AI-powered study decks from your notes",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${dmSans.variable} ${syne.variable} h-full antialiased dark`}>
      <body className="h-full bg-background text-foreground">
        {user ? (
          <div className="flex h-full">
            <AppSidebar user={user} />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        ) : (
          <div className="flex min-h-full flex-col">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2.5 group">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/25 bg-primary/12 transition-all duration-300 group-hover:bg-primary/20 group-hover:border-primary/40">
                    <svg
                      className="text-primary w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
                    </svg>
                  </div>
                  <span className="font-heading text-sm font-bold tracking-tight text-foreground">Quizly</span>
                </Link>
                <Link href="/auth/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Sign in
                </Link>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
