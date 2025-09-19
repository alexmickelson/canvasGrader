import type { CanvasSubmission } from "../../server/trpc/routers/canvas/canvasModels";

export function userName(submission: CanvasSubmission): string {
  const user = submission.user;

  // Handle null/undefined user
  if (!user) {
    return "Unknown student";
  }

  // Handle normalized user object with id and name
  if (typeof user === "object" && user !== null && "name" in user) {
    const name = user.name;
    if (typeof name === "string") {
      const trimmed = name.trim();
      return trimmed.length > 0 ? trimmed : "Unknown student";
    }
  }

  console.warn("Unexpected user structure:", user);
  return "Unknown student";
}
