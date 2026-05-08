"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

type NotificationPayload = {
  challenge_id?: string;
  attempt_id?: string;
  from_user_display_name?: string;
  title?: string;
  score?: number;
  total?: number;
};

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

export function NotificationPanel({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channelName = `notifications:${userId}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClick(n: Notification) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
    setOpen(false);
    const p = n.payload as NotificationPayload;
    if (n.type === "challenge_received" && p.challenge_id) {
      const { data: attempts } = await (await fetch(`/api/challenges`)).json();
      const received = (attempts as { challenge_id: string; id: string }[] | undefined) ?? [];
      const attempt = received.find?.((a) => a.challenge_id === p.challenge_id);
      if (attempt) {
        router.push(`/challenges/${attempt.id}/play`);
      } else {
        router.push("/challenges");
      }
    } else if (n.type === "challenge_completed" && p.challenge_id) {
      router.push(`/challenges/${p.challenge_id}/results`);
    }
  }

  function label(n: Notification): string {
    const p = n.payload as NotificationPayload;
    if (n.type === "challenge_received") {
      return `${p.from_user_display_name ?? "Someone"} challenged you — ${p.title ?? "a quiz"}`;
    }
    if (n.type === "challenge_completed") {
      return `${p.from_user_display_name ?? "Someone"} completed your challenge — ${p.score ?? 0}/${p.total ?? 0}`;
    }
    return "New notification";
  }

  function timeAgo(ts: string): string {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 left-3 z-50 w-72 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground/60">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0 ${!n.read ? "bg-primary/5" : ""}`}
                >
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  {n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{label(n)}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
