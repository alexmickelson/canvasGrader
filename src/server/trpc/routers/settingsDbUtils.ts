import { db } from "../../services/dbUtils.js";
import { z } from "zod";
import { parseSchema } from "./parseSchema.js";

const FavoriteCourseSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
});

export async function getFavoriteCourses(): Promise<
  z.infer<typeof FavoriteCourseSchema>[]
> {
  const results = await db.manyOrNone(
    `SELECT course_id AS id, name FROM favorite_courses`
  );
  return results.map((r) =>
    parseSchema(FavoriteCourseSchema, r, "favorite_courses row")
  );
}

export async function addFavoriteCourse(
  courseId: number,
  courseName: string
): Promise<void> {
  await db.none(
    `INSERT INTO favorite_courses (course_id, name)
     VALUES ($<courseId>, $<courseName>)
     ON CONFLICT (course_id) DO UPDATE SET name = $<courseName>`,
    { courseId, courseName }
  );
}

export async function removeFavoriteCourse(courseId: number): Promise<void> {
  await db.none(`DELETE FROM favorite_courses WHERE course_id = $<courseId>`, {
    courseId,
  });
}
