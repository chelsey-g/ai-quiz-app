"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: getEmailRedirectTo() },
  });

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/signup?message=${encodeURIComponent("Check your email to confirm your account.")}`);
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
