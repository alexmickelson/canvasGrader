import { db } from "../../../services/dbUtils.js";
import { parseSchema } from "../parseSchema.js";
import {
  GithubStudentUsernameSchema,
  GithubClassroomCourseSchema,
  GithubClassroomAssignmentSchema,
  SubmissionGitRepositorySchema,
} from "./gitModels.js";

// GitHub Student Usernames
export async function storeGithubStudentUsername({
  courseId,
  enrollmentId,
  githubUsername,
}: {
  courseId: number;
  enrollmentId: number;
  githubUsername: string;
}) {
  return await db.none(
    `
    INSERT INTO github_student_usernames (course_id, enrollment_id, github_username)
    VALUES ($<courseId>, $<enrollmentId>, $<githubUsername>)
    ON CONFLICT (course_id, enrollment_id)
    DO UPDATE SET github_username = EXCLUDED.github_username
    `,
    { courseId, enrollmentId, githubUsername }
  );
}

export async function getGithubStudentUsernames(courseId: number) {
  const result = await db.manyOrNone(
    `
    SELECT course_id, enrollment_id, github_username
    FROM github_student_usernames
    WHERE course_id = $<courseId>
    `,
    { courseId }
  );
  return result.map((r) =>
    parseSchema(GithubStudentUsernameSchema, r, "GithubStudentUsername")
  );
}

// GitHub Classroom Courses
export async function storeGithubClassroomCourse({
  githubClassroomId,
  courseId,
}: {
  githubClassroomId: number;
  courseId: number;
}) {
  return await db.none(
    `
    INSERT INTO github_classroom_courses (github_classroom_id, course_id)
    VALUES ($<githubClassroomId>, $<courseId>)
    ON CONFLICT (github_classroom_id)
    DO UPDATE SET course_id = EXCLUDED.course_id
    `,
    { githubClassroomId, courseId }
  );
}

export async function getGithubClassroomCoursesByCanvasCourseId(
  courseId: number
) {
  const result = await db.manyOrNone(
    `
    SELECT github_classroom_id, course_id
    FROM github_classroom_courses
    WHERE course_id = $<courseId>
    `,
    { courseId }
  );
  return result.map((r) =>
    parseSchema(GithubClassroomCourseSchema, r, "GithubClassroomCourse")
  );
}

// GitHub Classroom Assignments
export async function storeGithubClassroomAssignment({
  githubClassroomAssignmentId,
  assignmentId,
  githubClassroomId,
}: {
  githubClassroomAssignmentId: number;
  assignmentId: number;
  githubClassroomId: number;
}) {
  return await db.none(
    `
    INSERT INTO github_classroom_assignments (github_classroom_assignment_id, assignment_id, github_classroom_id)
    VALUES ($<githubClassroomAssignmentId>, $<assignmentId>, $<githubClassroomId>)
    ON CONFLICT (github_classroom_assignment_id)
    DO UPDATE SET 
      assignment_id = EXCLUDED.assignment_id,
      github_classroom_id = EXCLUDED.github_classroom_id
    `,
    { githubClassroomAssignmentId, assignmentId, githubClassroomId }
  );
}

export async function getGithubClassroomAssignmentsByCanvasAssignmentId(
  assignmentId: number
) {
  const result = await db.manyOrNone(
    `
    SELECT github_classroom_assignment_id, assignment_id, github_classroom_id
    FROM github_classroom_assignments
    WHERE assignment_id = $<assignmentId>
    `,
    { assignmentId }
  );
  return result.map((r) =>
    parseSchema(GithubClassroomAssignmentSchema, r, "GithubClassroomAssignment")
  );
}

// Submission Git Repository
export async function storeSubmissionGitRepository({
  enrollmentId,
  assignmentId,
  repoUrl,
  repoPath,
}: {
  enrollmentId: number;
  assignmentId: number;
  repoUrl: string;
  repoPath?: string;
}) {
  return await db.one(
    `
    INSERT INTO submission_git_repository (enrollment_id, assignment_id, repo_url, repo_path)
    VALUES ($<enrollmentId>, $<assignmentId>, $<repoUrl>, $<repoPath>)
    RETURNING id
    `,
    { enrollmentId, assignmentId, repoUrl, repoPath: repoPath || null }
  );
}

export async function getAssignmentGitRepositories(assignmentId: number) {
  const result = await db.manyOrNone(
    `
    SELECT id, enrollment_id, assignment_id, repo_url, repo_path
    FROM submission_git_repository
    WHERE assignment_id = $<assignmentId>
    ORDER BY id
    `,
    { assignmentId }
  );
  return result.map((r) =>
    parseSchema(SubmissionGitRepositorySchema, r, "SubmissionGitRepository")
  );
}
