import Link from "next/link";
import { signIn, sendMagicLink } from "@/app/auth/actions";
import { buttonVariants } from "@/components/ui/button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Study smarter with AI-powered flashcards.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {message && (
          <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
            <p className="text-sm text-foreground">{message}</p>
          </div>
        )}

        <form action={signIn} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className={buttonVariants({ className: "w-full" })}
          >
            Sign in
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form action={sendMagicLink} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="magic-email" className="text-sm font-medium">
              Email (magic link)
            </label>
            <input
              id="magic-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            Send magic link
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/auth/signup" className="text-foreground underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
