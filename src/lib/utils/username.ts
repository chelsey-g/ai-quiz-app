export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const USERNAME_ERROR = "3–20 characters: lowercase letters, numbers, and underscores only.";

export function isValidUsername(s: string): boolean {
  return USERNAME_RE.test(s);
}
