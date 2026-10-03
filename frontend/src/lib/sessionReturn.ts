const KEY = "hive_return_to";

/** Only allow same-origin relative paths (open-redirect safe). */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/login") || path.startsWith("/signup")) return false;
  return true;
}

export function rememberReturnTo(path: string) {
  if (!isSafeReturnPath(path)) return;
  sessionStorage.setItem(KEY, path);
}

export function peekReturnTo(): string | null {
  const path = sessionStorage.getItem(KEY);
  return isSafeReturnPath(path) ? path : null;
}

/** Read once and clear so a later login doesn't bounce oddly. */
export function consumeReturnTo(fallback = "/meetings"): string {
  const path = peekReturnTo();
  sessionStorage.removeItem(KEY);
  return path ?? fallback;
}

export function authPath(mode: "login" | "signup", returnTo?: string | null) {
  const base = mode === "login" ? "/login" : "/signup";
  if (!isSafeReturnPath(returnTo ?? null)) return base;
  return `${base}?next=${encodeURIComponent(returnTo!)}`;
}
