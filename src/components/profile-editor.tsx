"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  userId: string;
  userEmail: string;
  initialDisplayName: string | null;
  initialAvatarUrl: string | null;
};

export function ProfileEditor({ userId, userEmail, initialDisplayName, initialAvatarUrl }: Props) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(initialDisplayName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = (displayName || userEmail).charAt(0).toUpperCase();

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("File must be an image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("File must be under 2MB.");
      return;
    }

    setUploadError(null);
    setUploading(true);

    const supabase = createClient();
    const path = `${userId}/avatar`;

    const { error: storageError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (storageError) {
      setUploadError("Upload failed. Please try again.");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });

    if (!res.ok) {
      setUploadError("Failed to save avatar. Please try again.");
      setUploading(false);
      return;
    }

    // Cache-bust so the browser reloads the image even though the path is the same
    setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    setUploading(false);
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    setNameSaving(true);
    setNameError(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmed }),
    });

    if (!res.ok) {
      const data = await res.json();
      setNameError(data.error ?? "Failed to save.");
      setNameSaving(false);
      return;
    }

    setDisplayName(trimmed);
    setEditing(false);
    setNameSaving(false);
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar column */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-[120px] w-[120px] overflow-hidden rounded-full border-2 border-border/40">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/15 text-4xl font-bold text-primary">
                {initials}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs"
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </Button>
          {uploadError && (
            <p className="max-w-[130px] text-center text-xs text-destructive">{uploadError}</p>
          )}
        </div>

        {/* Name + email + edit */}
        <div className="flex-1 pt-1">
          <h2 className="font-heading text-2xl font-bold text-foreground">
            {displayName || (
              <span className="italic text-muted-foreground/50">No name set</span>
            )}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground/60">{userEmail}</p>

          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNameInput(displayName);
                setEditing(true);
                setNameError(null);
              }}
              className="mt-3 text-xs"
            >
              Edit name
            </Button>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.slice(0, 30))}
                className="w-full max-w-xs rounded-lg border border-border/40 bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                placeholder="Your name"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground/50">{nameInput.length}/30</p>
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={!nameInput.trim() || nameSaving}
                  className="text-xs"
                >
                  {nameSaving ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setNameError(null);
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
