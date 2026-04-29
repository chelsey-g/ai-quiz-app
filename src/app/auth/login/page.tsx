import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { buttonVariants } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/12 shadow-[0_0_20px_oklch(0.77_0.195_68_/_0.12)]">
            <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.5C10 1.5 10.9 7.2 13.8 9.5C16.4 11.6 20 11 20 11C20 11 16.4 10.4 13.8 12.5C10.9 14.8 10 20 10 20C10 20 9.1 14.8 6.2 12.5C3.6 10.4 0 11 0 11C0 11 3.6 11.6 6.2 9.5C9.1 7.2 10 1.5 10 1.5Z" />
            </svg>
          </div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Sign in to Quizly
          </h1>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Study smarter with AI-powered flashcards.
          </p>
        </div>

        {/* Form card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/70 p-6 backdrop-blur-sm">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />

          {error && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 shadow-[0_0_0_1px_oklch(0.77_0.195_68_/_0.2)_inset]">
              <p className="text-sm font-medium text-foreground">{message}</p>
            </div>
          )}

          <form action={signIn} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-foreground/70">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-input/70 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-foreground/70">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-input/70 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/70 transition-all"
              />
            </div>
            <button type="submit" className={buttonVariants({ className: "w-full" })}>
              Sign in
            </button>
          </form>

        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground/60">
          No account?{" "}
          <Link href="/auth/signup" className="text-foreground/80 underline underline-offset-4 hover:text-primary transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
