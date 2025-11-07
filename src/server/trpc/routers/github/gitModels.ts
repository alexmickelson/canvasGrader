import { z } from "zod";

// Schemas
export const GithubStudentUsernameSchema = z.object({
  course_id: z.number(),
  enrollment_id: z.number(),
  github_username: z.string().nullable(),
});

export const GithubClassroomCourseSchema = z.object({
  github_classroom_id: z.number(),
  course_id: z.number(),
});

export const GithubClassroomAssignmentSchema = z.object({
  github_classroom_assignment_id: z.number(),
  assignment_id: z.number(),
  github_classroom_id: z.number(),
});

export const SubmissionGitRepositorySchema = z.object({
  id: z.number(),
  enrollment_id: z.number(),
  assignment_id: z.number(),
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
