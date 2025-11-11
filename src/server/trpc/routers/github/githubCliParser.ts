import { z } from "zod";

export const GitHubClassroomSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
});

export const GitHubAssignmentSchema = z.object({
  id: z.number(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
});

export const GitHubAcceptedAssignmentSchema = z.object({
  id: z.number(),
  submitted: z.boolean(),
  passing: z.boolean(),
  commitCount: z.number(),
  students: z.array(z.string()),
  repositoryUrl: z.string(),
});

export type GitHubClassroom = z.infer<typeof GitHubClassroomSchema>;
export type GitHubAssignment = z.infer<typeof GitHubAssignmentSchema>;
export type GitHubAcceptedAssignment = z.infer<
  typeof GitHubAcceptedAssignmentSchema
>;

/**
 * Parses the output from `gh classroom list` command
 */
export function parseClassroomList(output: string): GitHubClassroom[] {
  const lines = output.trim().split("\n");

  // Return empty array if no data
  if (lines.length === 0) return [];

  // Find the header line that contains "ID", "Name", "URL"
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes("ID") && line.includes("Name") && line.includes("URL")) {
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

      // Split by multiple whitespace to handle the tabular format
      const parts = trimmed.split(/\s{2,}/);
      if (parts.length < 3) return null;

      const idStr = parts[0]?.trim();
      const name = parts[1]?.trim();
      const url = parts[2]?.trim();

      // Validate that ID is numeric and other fields exist
      if (!idStr || !idStr.match(/^\d+$/) || !name || !url) return null;

      const id = parseInt(idStr);
      if (isNaN(id)) return null;

      return {
        id,
        name,
        url,
      };
    })
    .filter(
      (classroom): classroom is GitHubClassroom =>
        classroom !== null && classroom.name !== "" && !isNaN(classroom.id)
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
    .map((line): GitHubAssignment | null => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      // Split by tab or multiple spaces, but be more flexible
      const parts = trimmed.split(/\t|\s{2,}/);

      const idStr = parts[0]?.trim();
      if (!idStr || !idStr.match(/^\d+$/)) return null; // ID should be numeric

      const id = parseInt(idStr);
      if (isNaN(id)) return null;

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
      (assignment): assignment is GitHubAssignment => assignment !== null
    );
}

/**
 * Parses the output from `gh classroom accepted-assignments --assignment-id <id>` command
 * Expected format:
 * ```
 * Assignment: lab10Assignment
 * ID: 890322
 *
 * ID        Submitted  Passing  Commit Count  Grade  Feedback Pull Request URL  Student                       Repository
 * 21391584  false      false    7                                               student1, student2            https://github.com/...
 * ```
 */
export function parseAcceptedAssignmentList(
  output: string
): GitHubAcceptedAssignment[] {
  const lines = output.trim().split("\n");

  // Return empty array if no data
  if (lines.length === 0) return [];

  // Find the header line (contains "ID", "Submitted", "Repository")
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.startsWith("ID") &&
      line.includes("Submitted") &&
      line.includes("Repository")
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
    .map((line): GitHubAcceptedAssignment | null => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      // Split by multiple spaces (2 or more)
      const parts = trimmed.split(/\s{2,}/);
      if (parts.length < 5) return null;

      const idStr = parts[0]?.trim();
      if (!idStr || !idStr.match(/^\d+$/)) return null;

      const id = parseInt(idStr);
      if (isNaN(id)) return null;

      const submitted = parts[1]?.trim().toLowerCase() === "true";
      const passing = parts[2]?.trim().toLowerCase() === "true";

      const commitCountStr = parts[3]?.trim();
      const commitCount = commitCountStr ? parseInt(commitCountStr) : 0;

      // Find the student column and repository URL
      // The format is typically: ID, Submitted, Passing, CommitCount, Grade, Feedback, Student, Repository
      // We need to find the last two columns which contain student names and repository URL
      const studentsPart = parts[parts.length - 2]?.trim();
      const repositoryUrl = parts[parts.length - 1]?.trim();

      if (!studentsPart || !repositoryUrl) return null;

      // Parse student names (comma-separated)
      const students = studentsPart
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Validate repository URL
      if (!repositoryUrl.startsWith("http")) return null;

      return {
        id,
        submitted,
        passing,
        commitCount,
        students,
        repositoryUrl,
      };
    })
    .filter(
      (assignment): assignment is GitHubAcceptedAssignment =>
        assignment !== null
    );
}
