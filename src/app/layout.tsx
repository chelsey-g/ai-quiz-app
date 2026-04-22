import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

const inter = Inter({
  variable: "--font-sans",
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
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="text-sm font-semibold tracking-tight text-foreground"
              >
                Quizly
              </Link>
              {user && (
                <nav className="flex items-center gap-1">
                  <Link
                    href="/"
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Decks
                  </Link>
                  <Link
                    href="/import"
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Import
                  </Link>
                </nav>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {user.email}
                  </span>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
