import { z } from "zod";

// Schemas
export const GithubStudentUsernameSchema = z.object({
  course_id: z.coerce.number(),
  enrollment_id: z.coerce.number(),
  github_username: z.string().nullable(),
});

export const GithubClassroomCourseSchema = z.object({
  github_classroom_id: z.coerce.number(),
  course_id: z.coerce.number(),
  name: z.string(),
  url: z.string(),
});

export const GithubClassroomAssignmentSchema = z.object({
  github_classroom_assignment_id: z.coerce.number(),
  assignment_id: z.coerce.number(),
  github_classroom_id: z.coerce.number(),
  name: z.string(),
});

export const SubmissionGitRepositorySchema = z.object({
  id: z.coerce.number(),
  user_id: z.coerce.number(),
  assignment_id: z.coerce.number(),
  repo_url: z.string(),
  repo_path: z.string().nullable(),
});

export type GithubStudentUsername = z.infer<typeof GithubStudentUsernameSchema>;
export type GithubClassroomCourse = z.infer<typeof GithubClassroomCourseSchema>;
export type GithubClassroomAssignment = z.infer<
  typeof GithubClassroomAssignmentSchema
>;
export type SubmissionGitRepository = z.infer<
  typeof SubmissionGitRepositorySchema
>;
