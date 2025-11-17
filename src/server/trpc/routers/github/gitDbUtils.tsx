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
  userId,
  githubUsername,
}: {
  courseId: number;
  userId: number;
  githubUsername: string;
}) {
  return await db.none(
    `
    INSERT INTO github_student_usernames (course_id, user_id, github_username)
    VALUES ($<courseId>, $<userId>, $<githubUsername>)
    ON CONFLICT (course_id, user_id)
    DO UPDATE SET github_username = EXCLUDED.github_username
    `,
    { courseId, userId, githubUsername }
  );
}

export async function getGithubStudentUsernames(courseId: number) {
  const result = await db.manyOrNone(
    `
    SELECT course_id, user_id, github_username
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
  await db.none(
    `
    DELETE FROM github_classroom_courses
    WHERE course_id = $<courseId>
    `,
    { courseId }
  );

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
  await db.none(
    `
    INSERT INTO submission_git_repository (user_id, assignment_id, repo_url, repo_path)
    VALUES ($<userId>, $<assignmentId>, $<repoUrl>, $<repoPath>)
    `,
    { userId, assignmentId, repoUrl, repoPath: repoPath || null }
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

export async function getPreviousAssignmentRepositoriesForUser({
  userId,
  assignmentId,
}: {
  userId: number;
  assignmentId: number;
}) {
  const result = await db.manyOrNone(
    `
    SELECT 
      sgr.id, 
      sgr.user_id, 
      sgr.assignment_id, 
      sgr.repo_url, 
      sgr.repo_path,
      a.canvas_object->>'name' as assignment_name,
      (a.canvas_object->>'due_at')::timestamp as due_at
    FROM submission_git_repository sgr
    JOIN assignments a ON sgr.assignment_id = a.id
    WHERE sgr.user_id = $<userId>
      AND a.course_id = (SELECT course_id FROM assignments WHERE id = $<assignmentId>)
      AND 
        (a.canvas_object->>'due_at')::timestamp < (
          SELECT (canvas_object->>'due_at')::timestamp 
          FROM assignments WHERE id = $<assignmentId>
        )
    ORDER BY (a.canvas_object->>'due_at')::timestamp DESC
    `,
    { userId, assignmentId }
  );
  return result.map((r) => ({
    ...parseSchema(
      SubmissionGitRepositorySchema,
      {
        id: r.id,
        user_id: r.user_id,
        assignment_id: r.assignment_id,
        repo_url: r.repo_url,
        repo_path: r.repo_path,
      },
      "SubmissionGitRepository"
    ),
    assignment_name: r.assignment_name as string,
    due_at: r.due_at as string | null,
  }));
}
