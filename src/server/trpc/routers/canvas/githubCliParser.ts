import { z } from "zod";

export const GitHubClassroomSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
});

export const GitHubAssignmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
});

export const CourseScheduleSchema = z.object({
  crn: z.string(),
  course: z.string(),
  section: z.string(),
  courseTitle: z.string(),
  meetingPattern: z.string(),
  instructorName: z.string(),
  room: z.string(),
  creditHrs: z.string(),
});

export type GitHubClassroom = z.infer<typeof GitHubClassroomSchema>;
export type GitHubAssignment = z.infer<typeof GitHubAssignmentSchema>;
export type CourseSchedule = z.infer<typeof CourseScheduleSchema>;

/**
 * Parses the output from `gh classroom list` command
 */
export function parseClassroomList(output: string): GitHubClassroom[] {
  const lines = output.trim().split("\n");

  // Return empty array if no data or only header
  if (lines.length <= 1) return [];

  // Skip header line and parse data
  return lines
    .slice(1)
    .map((line) => {
      // Split by whitespace but preserve multi-word names
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) return null;

      const id = parts[0];
      const url = parts[parts.length - 1]; // URL is always last
      // Name is everything between ID and URL
      const name = parts.slice(1, -1).join(" ");

      return {
        id,
        name: name?.trim() || "",
        url: url?.trim() || "",
      };
    })
    .filter(
      (classroom): classroom is GitHubClassroom =>
        classroom !== null && classroom.name !== "" && classroom.id !== ""
    );
}

/**
 * Parses the output from `gh classroom assignment list --classroom <id>` command
 * Expected format may vary, but typically:
 * ```
 * ID      Title             Type        Status
 * 123456  Assignment 1      individual  active
 * 789012  Group Project     group       draft
 * ```
 */
export function parseAssignmentList(output: string): GitHubAssignment[] {
  const lines = output.trim().split("\n");

  // Return empty array if no data
  if (lines.length === 0) return [];

  // Find the header line (contains "ID" and other column headers)
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.startsWith("ID") &&
      (line.includes("Title") || line.includes("Type"))
    ) {
      headerIndex = i;
      break;
    }
  }

  // If no header found, return empty array
  if (headerIndex === -1) return [];

  // Parse data lines after header
  return lines
    .slice(headerIndex + 1)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      // Split by tab or multiple spaces, but be more flexible
      const parts = trimmed.split(/\t|\s{2,}/);

      const id = parts[0]?.trim();
      if (!id || !id.match(/^\d+$/)) return null; // ID should be numeric

      // For the actual GitHub CLI format, title is in column 1, type might be in column 4
      const title = parts[1]?.trim() || `Assignment ${id}`;
      let type = "individual";
      let status = "active"; // Default to active for actual assignments

      // Try to find type column - it's usually "individual" or "group"
      for (let i = 2; i < parts.length; i++) {
        const part = parts[i]?.trim().toLowerCase();
        if (part === "individual" || part === "group") {
          type = part;
          break;
        }
      }

      // Try to find status column - look for common status values
      for (let i = 2; i < parts.length; i++) {
        const part = parts[i]?.trim().toLowerCase();
        if (["active", "draft", "published", "unknown"].includes(part)) {
          status = part;
          break;
        }
      }

      return {
        id,
        title,
        type,
        status,
      };
    })
    .filter(
      (assignment): assignment is GitHubAssignment =>
        assignment !== null && assignment.id !== ""
    );
}
