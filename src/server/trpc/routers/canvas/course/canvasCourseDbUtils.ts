import { db } from "../../../../services/dbUtils.js";
import {
  CanvasCourseSchema,
  CanvasEnrollmentSchema,
  type CanvasCourse,
  type CanvasEnrollment,
} from "../canvasModels.js";
import { parseSchema } from "../../parseSchema.js";

export async function storeCourse(course: CanvasCourse) {
  await db.none(
    `
    INSERT INTO courses (id, term_id, term_name, canvas_object, updated_at)
    VALUES ($<id>, $<termId>, $<termName>, $<course>, CURRENT_TIMESTAMP)
    ON CONFLICT (id) 
    DO UPDATE SET 
      term_id = EXCLUDED.term_id,
      term_name = EXCLUDED.term_name,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
    `,
    {
      id: course.id,
      termId: course.term.id,
      termName: course.term.name,
      course,
    }
  );
}

export async function storeCourses(courses: CanvasCourse[]) {
  if (courses.length === 0) return;

  const queries = courses.map((course) =>
    db.none(
      `
      INSERT INTO courses (id, term_id, term_name, canvas_object, updated_at)
      VALUES ($<id>, $<termId>, $<termName>, $<course>, CURRENT_TIMESTAMP)
      ON CONFLICT (id) 
      DO UPDATE SET 
        term_id = EXCLUDED.term_id,
        term_name = EXCLUDED.term_name,
        canvas_object = EXCLUDED.canvas_object,
        updated_at = CURRENT_TIMESTAMP
      `,
      {
        id: course.id,
        termId: course.term.id,
        termName: course.term.name,
        course,
      }
    )
  );

  await Promise.all(queries);
}

export async function getCourse(courseId: number) {
  const result = await db.oneOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object FROM courses WHERE id = $<courseId>`,
    { courseId }
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
    VALUES ($<id>, $<courseId>, $<userId>, $<enrollment>, CURRENT_TIMESTAMP)
    ON CONFLICT (id) 
    DO UPDATE SET 
      course_id = EXCLUDED.course_id,
      user_id = EXCLUDED.user_id,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
    `,
    {
      id: enrollment.id,
      courseId: enrollment.course_id,
      userId: enrollment.user_id,
      enrollment,
    }
  );
}

export async function storeEnrollments(enrollments: CanvasEnrollment[]) {
  if (enrollments.length === 0) return;

  const queries = enrollments.map((enrollment) =>
    db.none(
      `
      INSERT INTO enrollments (id, course_id, user_id, canvas_object, updated_at)
      VALUES ($<id>, $<courseId>, $<userId>, $<enrollment>, CURRENT_TIMESTAMP)
      ON CONFLICT (id) 
      DO UPDATE SET 
        course_id = EXCLUDED.course_id,
        user_id = EXCLUDED.user_id,
        canvas_object = EXCLUDED.canvas_object,
        updated_at = CURRENT_TIMESTAMP
      `,
      {
        id: enrollment.id,
        courseId: enrollment.course_id,
        userId: enrollment.user_id,
        enrollment,
      }
    )
  );

  await Promise.all(queries);
}

export async function getCourseEnrollments(courseId: number) {
  const results = await db.manyOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object 
    FROM enrollments 
    WHERE course_id = $<courseId>
      ORDER BY updated_at DESC`,
    { courseId }
  );
  return results.map((r) =>
    parseSchema(
      CanvasEnrollmentSchema,
      r.canvas_object,
      "CanvasEnrollment from DB"
    )
  );
}
