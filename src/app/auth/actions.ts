"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, USERNAME_ERROR } from "@/lib/utils/username";

function getEmailRedirectTo() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl && !configuredSiteUrl.includes("localhost")) {
    return `${configuredSiteUrl.replace(/\/$/, "")}/auth/callback`;
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}/auth/callback`;
  }

  return `${(configuredSiteUrl ?? "http://localhost:3001").replace(/\/$/, "")}/auth/callback`;
}

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = ((formData.get("username") as string | null) ?? "").trim().toLowerCase();
  const displayName = ((formData.get("display_name") as string | null) ?? "").trim();

  if (!isValidUsername(username)) {
    redirect(`/auth/signup?error=${encodeURIComponent(USERNAME_ERROR)}`);
  }

  // Check username availability before creating the auth user so we don't
  // orphan an auth account when the profile upsert would fail with 23505.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    redirect(`/auth/signup?error=${encodeURIComponent("That username is already taken.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getEmailRedirectTo() },
  });

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      username,
      display_name: displayName || null,
    });

    if (profileError) {
      // Clean up the orphaned auth user so the email can be reused.
      await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
      const msg =
        profileError.code === "23505"
          ? "That username is already taken."
          : profileError.message;
      redirect(`/auth/signup?error=${encodeURIComponent(msg)}`);
    }
  }

  if (data.session) {
    redirect("/");
  }

  redirect(
    `/auth/signup?message=${encodeURIComponent("Check your email to confirm your account.")}`
  );
}

export async function sendMagicLink(formData: FormData) {
  const email = formData.get("email") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: getEmailRedirectTo() },
  });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/login?message=${encodeURIComponent("Magic link sent — check your email.")}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
