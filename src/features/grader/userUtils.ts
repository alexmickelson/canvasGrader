export function userName(s: { user?: unknown }): string {
  const u: unknown = s.user;
  if (!u) return "Unknown student";
  if (typeof u === "string") return u || "Unknown student";
  if (typeof u === "object" && u !== null && "name" in u) {
    const name = (u as { name?: unknown }).name;
    if (typeof name === "string" && name.length > 0) return name;
  }
  return "Unknown student";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const chars = parts
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return chars || "?";
}
