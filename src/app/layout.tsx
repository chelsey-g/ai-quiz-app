import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { buttonVariants } from "@/components/ui/button";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quizly",
  description: "AI-powered study decks from your notes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            </div>
            <Link
              href="/import"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Import
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
