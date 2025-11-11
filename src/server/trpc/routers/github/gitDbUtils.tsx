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
  name,
  url,
}: {
  githubClassroomId: number;
  courseId: number;
  name: string;
  url: string;
}) {
  return await db.none(
    `
    INSERT INTO github_classroom_courses (github_classroom_id, course_id, name, url)
    VALUES ($<githubClassroomId>, $<courseId>, $<name>, $<url>)
    ON CONFLICT (github_classroom_id)
    DO UPDATE SET 
      course_id = EXCLUDED.course_id,
      name = EXCLUDED.name,
      url = EXCLUDED.url
    `,
    { githubClassroomId, courseId, name: name, url: url }
  );
}

export async function getGithubClassroomCoursesByCanvasCourseId(
  courseId: number
) {
  const result = await db.oneOrNone(
    `
    SELECT github_classroom_id, course_id, name, url
    FROM github_classroom_courses
    WHERE course_id = $<courseId>
    `,
    { courseId }
  );
  return result
    ? parseSchema(GithubClassroomCourseSchema, result, "GithubClassroomCourse")
    : null;
}

// GitHub Classroom Assignments
export async function storeGithubClassroomAssignment({
  githubClassroomAssignmentId,
  assignmentId,
  githubClassroomId,
  name,
}: {
  githubClassroomAssignmentId: number;
  assignmentId: number;
  githubClassroomId: number;
  name: string;
}) {
  return await db.none(
    `
    INSERT INTO github_classroom_assignments (github_classroom_assignment_id, assignment_id, github_classroom_id, name)
    VALUES ($<githubClassroomAssignmentId>, $<assignmentId>, $<githubClassroomId>, $<name>)
    ON CONFLICT (github_classroom_assignment_id)
    DO UPDATE SET 
      assignment_id = EXCLUDED.assignment_id,
      github_classroom_id = EXCLUDED.github_classroom_id,
      name = EXCLUDED.name
    `,
    { githubClassroomAssignmentId, assignmentId, githubClassroomId, name }
  );
}

export async function getGithubClassroomAssignmentsByCanvasAssignmentId(
  assignmentId: number
) {
  const result = await db.oneOrNone(
    `
    SELECT github_classroom_assignment_id, assignment_id, github_classroom_id, name
    FROM github_classroom_assignments
    WHERE assignment_id = $<assignmentId>
    `,
    { assignmentId }
  );
  if (!result) {
    return null;
  }
  return parseSchema(
    GithubClassroomAssignmentSchema,
    result,
    "GithubClassroomAssignment"
  );
}

// Submission Git Repository
export async function setSubmissionGitRepository({
  userId,
  assignmentId,
  repoUrl,
  repoPath,
}: {
  userId: number;
  assignmentId: number;
  repoUrl: string;
  repoPath?: string;
}) {
  const result = await db.one(
    `
    INSERT INTO submission_git_repository (user_id, assignment_id, repo_url, repo_path)
    VALUES ($<userId>, $<assignmentId>, $<repoUrl>, $<repoPath>)
    RETURNING id
    `,
    { userId, assignmentId, repoUrl, repoPath: repoPath || null }
  );
  return parseSchema(
    SubmissionGitRepositorySchema,
    result,
    "SubmissionGitRepository"
  );
}

export async function getAssignmentGitRepositories(assignmentId: number) {
  const result = await db.manyOrNone(
    `
    SELECT id, user_id, assignment_id, repo_url, repo_path
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
