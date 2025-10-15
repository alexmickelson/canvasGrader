import { db } from "../../../services/dbUtils.js";
import { z } from "zod";
import { parseSchema } from "../parseSchema.js";

export const studentGithubUsernameSchema = z.object({
  enrollmentId: z.number(),
  githubUsername: z.string(),
});

export type StudentGithubUsername = z.infer<typeof studentGithubUsernameSchema>;

export async function setGithubUsername(
  courseId: number,
  enrollmentId: number,
  githubUsername: string
): Promise<void> {
  await db.none(
    `INSERT INTO github_usernames (course_id, enrollment_id, github_username)
     VALUES ($<courseId>, $<enrollmentId>, $<githubUsername>)
     ON CONFLICT (course_id, enrollment_id) 
     DO UPDATE SET github_username = $<githubUsername>`,
    { courseId, enrollmentId, githubUsername }
  );
}

export async function getGithubUsernamesForCourse(
  courseId: number
): Promise<StudentGithubUsername[]> {
  const results = await db.manyOrNone<{
    enrollment_id: number;
    github_username: string;
  }>(
    `SELECT enrollment_id, github_username 
     FROM github_usernames 
     WHERE course_id = $<courseId>`,
    { courseId }
  );
  return results.map((r) =>
    parseSchema(
      studentGithubUsernameSchema,
      {
        enrollmentId: r.enrollment_id,
        githubUsername: r.github_username,
      },
      "StudentGithubUsername from DB"
    )
  );
}

export async function removeGithubUsername(
  courseId: number,
  enrollmentId: number
): Promise<void> {
  await db.none(
    `DELETE FROM github_usernames 
     WHERE course_id = $<courseId> AND enrollment_id = $<enrollmentId>`,
    { courseId, enrollmentId }
  );
}

export async function removeAllGithubUsernamesForCourse(
  courseId: number
): Promise<void> {
  await db.none(`DELETE FROM github_usernames WHERE course_id = $<courseId>`, {
    courseId,
  });
}
