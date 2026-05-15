"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { ProfileEditor } from "@/components/profile-editor";
import { signOut } from "@/app/auth/actions";
import { buttonVariants } from "@/components/ui/button";

type NotificationPrefs = {
  challenge_received: boolean;
  challenge_completed: boolean;
};

type ProfileData = {
  display_name: string | null;
  avatar_url: string | null;
  default_study_mode: "flip" | "type";
  daily_goal: number | null;
  notification_prefs: NotificationPrefs;
  email: string;
  username: string | null;
};

const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground/60">{description}</p>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "border border-border/60 bg-muted"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [studyMode, setStudyMode] = useState<"flip" | "type">("flip");
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [studySaving, setStudySaving] = useState(false);
  const [studySaved, setStudySaved] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    challenge_received: true,
    challenge_completed: true,
  });

  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setProfile(d);
        setStudyMode(d.default_study_mode ?? "flip");
        setDailyGoal(d.daily_goal ?? null);
        setNotifPrefs(
          d.notification_prefs ?? { challenge_received: true, challenge_completed: true }
        );
        setUsername(d.username ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveStudyPrefs() {
    setStudySaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_study_mode: studyMode, daily_goal: dailyGoal }),
    });
    setStudySaving(false);
    setStudySaved(true);
    setTimeout(() => setStudySaved(false), 2000);
  }

  async function saveUsername() {
    setUsernameSaving(true);
    setUsernameError(null);
    setUsernameSaved(false);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim().toLowerCase() }),
    });
    const data = await res.json();
    setUsernameSaving(false);
    if (!res.ok) {
      setUsernameError(data.error ?? "Failed to save");
    } else {
      setUsernameSaved(true);
      setTimeout(() => setUsernameSaved(false), 2000);
    }
  }

  async function toggleNotifPref(key: keyof NotificationPrefs) {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_prefs: next }),
    });
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/profile", { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error ?? "Failed to delete account.");
      setDeleting(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <div className="h-6 w-32 animate-pulse rounded bg-muted/40" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground">Settings</h1>

      {/* Profile */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading title="Profile" description="Update your display name and photo." />
        {profile && userId && (
          <ProfileEditor
            userId={userId}
            userEmail={profile.email}
            initialDisplayName={profile.display_name}
            initialAvatarUrl={profile.avatar_url}
          />
        )}
        {/* Username */}
        <div className="mt-5 space-y-2">
          <label className="block text-xs font-medium text-foreground/70">
            Username
            <span className="ml-1 text-muted-foreground/40">(3–20 chars, lowercase, underscores ok)</span>
          </label>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center rounded-xl border border-border/60 bg-muted/20 px-3 py-2 focus-within:ring-2 focus-within:ring-ring/70 transition-all">
              <span className="mr-1 text-sm text-muted-foreground/50">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setUsernameSaved(false); setUsernameError(null); }}
                placeholder="yourname"
                maxLength={20}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />
            </div>
            <button
              onClick={saveUsername}
              disabled={usernameSaving || username.length < 3}
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              {usernameSaving ? "Saving…" : usernameSaved ? "Saved ✓" : "Save"}
            </button>
          </div>
          {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
          {username.length >= 3 && !usernameError && !usernameSaving && (
            <p className="text-xs text-muted-foreground/50">
              Your profile: <span className="font-mono">/u/{username.trim().toLowerCase()}</span>
            </p>
          )}
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading title="Appearance" description="Choose how Quizly looks." />
        {mounted && (
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                  theme === t || (theme === "system" && t === "dark")
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Study preferences */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading
          title="Study preferences"
          description="Defaults used when you start a new study session."
        />
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Default study mode</p>
            <div className="flex gap-2">
              {(["flip", "type"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setStudyMode(m)}
                  className={`rounded-xl border px-4 py-2 text-xs font-medium transition-colors ${
                    studyMode === m
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {m === "flip" ? "Flip cards" : "Type answer"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Daily goal</p>
            <div className="flex flex-wrap gap-2">
              {DAILY_GOAL_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setDailyGoal(n)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    dailyGoal === n
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {n} cards
                </button>
              ))}
              <button
                onClick={() => setDailyGoal(null)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  dailyGoal === null
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                No goal
              </button>
            </div>
          </div>
          <button
            onClick={saveStudyPrefs}
            disabled={studySaving}
            className="rounded-xl border px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
            style={
              studySaved
                ? {
                    borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                    color: "var(--dashboard-accent-teal-strong)",
                    background: "color-mix(in oklch, var(--dashboard-accent-teal) 8%, transparent)",
                  }
                : {
                    borderColor: "oklch(0.5 0.01 65 / 0.3)",
                    color: "var(--foreground)",
                  }
            }
          >
            {studySaving ? "Saving…" : studySaved ? "Saved" : "Save preferences"}
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading
          title="Notifications"
          description="Control which notifications you receive."
        />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">Challenge received</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                When someone sends you a quiz challenge
              </p>
            </div>
            <Toggle
              checked={notifPrefs.challenge_received}
              onChange={() => toggleNotifPref("challenge_received")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-foreground">Challenge completed</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                When someone completes a challenge you sent
              </p>
            </div>
            <Toggle
              checked={notifPrefs.challenge_completed}
              onChange={() => toggleNotifPref("challenge_completed")}
            />
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <SectionHeading title="Account" />
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground/50">
              Email
            </p>
            <p className="text-sm text-foreground">{profile?.email ?? "—"}</p>
          </div>
          <div className="border-t border-border/30 pt-4">
            <form action={signOut}>
              <button
                type="submit"
                className={buttonVariants({ variant: "outline", size: "sm" }) + " text-xs"}
              >
                Sign out
              </button>
            </form>
          </div>
          <div className="border-t border-border/30 pt-4">
            <p className="mb-3 text-xs font-semibold text-destructive">Danger zone</p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl border px-4 py-2 text-xs font-medium transition-colors hover:bg-destructive/5"
                style={{
                  borderColor: "color-mix(in oklch, var(--destructive) 35%, transparent)",
                  color: "var(--destructive)",
                }}
              >
                Delete account
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-xs text-destructive/80">
                  This permanently deletes your account and all your data. This cannot be undone.
                </p>
                {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                    style={{ background: "var(--destructive)" }}
                  >
                    {deleting ? "Deleting…" : "Yes, delete my account"}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                    className="rounded-xl border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
