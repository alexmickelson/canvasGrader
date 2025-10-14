import { db } from "../../../services/dbUtils.js";
import {
  CanvasCourseSchema,
  CanvasEnrollmentSchema,
  type CanvasCourse,
  type CanvasEnrollment,
} from "./canvasModels.js";
import { parseSchema } from "../parseSchema.js";

export async function storeCourse(course: CanvasCourse) {
  await db.none(
    `
    INSERT INTO courses (id, term_id, term_name, canvas_object, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (id) 
    DO UPDATE SET 
      term_id = EXCLUDED.term_id,
      term_name = EXCLUDED.term_name,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
    `,
    [course.id, course.term.id, course.term.name, course]
  );
}

export async function storeCourses(courses: CanvasCourse[]) {
  if (courses.length === 0) return;

  const query = `
    INSERT INTO courses (id, term_id, term_name, canvas_object, updated_at)
    VALUES ${courses
      .map(
        (_, i) =>
          `($<courses[${i}].id>, $<courses[${i}].term.id>, $<courses[${i}].term.name>, $<courses[${i}]>, CURRENT_TIMESTAMP)`
      )
      .join(", ")}
    ON CONFLICT (id) 
    DO UPDATE SET 
      term_id = EXCLUDED.term_id,
      term_name = EXCLUDED.term_name,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
  `;

  await db.none(query, { courses });
}

export async function getCourse(courseId: number) {
  const result = await db.oneOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object FROM courses WHERE id = $1`,
    [courseId]
  );
  if (!result) return null;
  return parseSchema(
    CanvasCourseSchema,
    result.canvas_object,
    "CanvasCourse from DB"
  );
}

export async function getAllCourses() {
  const results = await db.manyOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object FROM courses ORDER BY updated_at DESC`
  );
  return results.map((r) =>
    parseSchema(CanvasCourseSchema, r.canvas_object, "CanvasCourse from DB")
  );
}

export async function storeEnrollment(enrollment: CanvasEnrollment) {
  await db.none(
    `
    INSERT INTO enrollments (id, course_id, user_id, canvas_object, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (id) 
    DO UPDATE SET 
      course_id = EXCLUDED.course_id,
      user_id = EXCLUDED.user_id,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
    `,
    [enrollment.id, enrollment.course_id, enrollment.user_id, enrollment]
  );
}

export async function storeEnrollments(enrollments: CanvasEnrollment[]) {
  if (enrollments.length === 0) return;

  const query = `
    INSERT INTO enrollments (id, course_id, user_id, canvas_object, updated_at)
    VALUES ${enrollments
      .map(
        (_, i) =>
          `($<enrollments[${i}].id>, $<enrollments[${i}].course_id>, $<enrollments[${i}].user_id>, $<enrollments[${i}]>, CURRENT_TIMESTAMP)`
      )
      .join(", ")}
    ON CONFLICT (id) 
    DO UPDATE SET 
      course_id = EXCLUDED.course_id,
      user_id = EXCLUDED.user_id,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
  `;

  await db.none(query, { enrollments });
}

export async function getCourseEnrollments(courseId: number) {
  const results = await db.manyOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object 
    FROM enrollments 
    WHERE course_id = $1 
      ORDER BY updated_at DESC`,
    [courseId]
  );
  return results.map((r) =>
    parseSchema(
      CanvasEnrollmentSchema,
      r.canvas_object,
      "CanvasEnrollment from DB"
    )
  );
}
