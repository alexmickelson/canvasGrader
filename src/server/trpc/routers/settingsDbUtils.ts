import { db } from "../../services/dbUtils.js";

export async function getFavoriteCourses(): Promise<number[]> {
  const results = await db.manyOrNone<{ course_id: number }>(
    `SELECT course_id FROM favorite_courses`
  );
  return results.map((r) => r.course_id);
}

export async function setFavoriteCourse(courseId: number): Promise<void> {
  await db.none(
    `INSERT INTO favorite_courses (course_id)
     VALUES ($<courseId>)
     ON CONFLICT DO NOTHING`,
    { courseId }
  );
}

export async function deleteFavoriteCourse(courseId: number): Promise<void> {
  await db.none(`DELETE FROM favorite_courses WHERE course_id = $<courseId>`, {
    courseId,
  });
}

export async function deleteAllFavoriteCourses(): Promise<void> {
  await db.none(`DELETE FROM favorite_courses`);
}
