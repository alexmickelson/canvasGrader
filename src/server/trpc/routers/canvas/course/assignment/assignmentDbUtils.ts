import { db } from "../../../../../services/dbUtils.js";
import {
  CanvasAssignmentSchema,
  CanvasSubmissionSchema,
  type CanvasAssignment,
  type CanvasSubmission,
} from "../../canvasModels.js";
import { parseSchema } from "../../../parseSchema.js";

export async function storeAssignment(assignment: CanvasAssignment) {
  await db.none(
    `
    INSERT INTO assignments (id, course_id, canvas_object, updated_at)
    VALUES ($<id>, $<courseId>, $<assignment>, CURRENT_TIMESTAMP)
    ON CONFLICT (id) 
    DO UPDATE SET 
      course_id = EXCLUDED.course_id,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
    `,
    {
      id: assignment.id,
      courseId: assignment.course_id,
      assignment,
    }
  );
}

export async function storeAssignments(assignments: CanvasAssignment[]) {
  if (assignments.length === 0) return;

  const queries = assignments.map((assignment) =>
    db.none(
      `
      INSERT INTO assignments (id, course_id, canvas_object, updated_at)
      VALUES ($<id>, $<courseId>, $<assignment>, CURRENT_TIMESTAMP)
      ON CONFLICT (id) 
      DO UPDATE SET 
        course_id = EXCLUDED.course_id,
        canvas_object = EXCLUDED.canvas_object,
        updated_at = CURRENT_TIMESTAMP
      `,
      {
        id: assignment.id,
        courseId: assignment.course_id,
        assignment,
      }
    )
  );

  await Promise.all(queries);
}

export async function getAssignment(assignmentId: number) {
  const result = await db.oneOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object FROM assignments WHERE id = $<assignmentId>`,
    { assignmentId }
  );
  if (!result) return null;
  return parseSchema(
    CanvasAssignmentSchema,
    result.canvas_object,
    "CanvasAssignment from DB"
  );
}

export async function getCourseAssignments(
  courseId: number
): Promise<CanvasAssignment[]> {
  const results = await db.manyOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object 
    FROM assignments 
    WHERE course_id = $<courseId>
    ORDER BY updated_at DESC`,
    { courseId }
  );
  return results.map((r) =>
    parseSchema(
      CanvasAssignmentSchema,
      r.canvas_object,
      "CanvasAssignment from DB"
    )
  );
}

export async function storeSubmission(submission: CanvasSubmission) {
  await db.none(
    `
    INSERT INTO submissions (id, assignment_id, user_id, canvas_object, updated_at)
    VALUES ($<id>, $<assignmentId>, $<userId>, $<submission>, CURRENT_TIMESTAMP)
    ON CONFLICT (id) 
    DO UPDATE SET 
      assignment_id = EXCLUDED.assignment_id,
      user_id = EXCLUDED.user_id,
      canvas_object = EXCLUDED.canvas_object,
      updated_at = CURRENT_TIMESTAMP
    `,
    {
      id: submission.id,
      assignmentId: submission.assignment_id,
      userId: submission.user_id,
      submission,
    }
  );
}

export async function storeSubmissions(submissions: CanvasSubmission[]) {
  if (submissions.length === 0) return;

  const queries = submissions.map((submission) =>
    db.none(
      `
      INSERT INTO submissions (id, assignment_id, user_id, canvas_object, updated_at)
      VALUES ($<id>, $<assignmentId>, $<userId>, $<submission>, CURRENT_TIMESTAMP)
      ON CONFLICT (id) 
      DO UPDATE SET 
        assignment_id = EXCLUDED.assignment_id,
        user_id = EXCLUDED.user_id,
        canvas_object = EXCLUDED.canvas_object,
        updated_at = CURRENT_TIMESTAMP
      `,
      {
        id: submission.id,
        assignmentId: submission.assignment_id,
        userId: submission.user_id,
        submission,
      }
    )
  );

  await Promise.all(queries);
}

export async function getSubmission(submissionId: number) {
  const result = await db.oneOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object FROM submissions WHERE id = $<submissionId>`,
    { submissionId }
  );
  if (!result) return null;
  return parseSchema(
    CanvasSubmissionSchema,
    result.canvas_object,
    "CanvasSubmission from DB"
  );
}

export async function getAssignmentSubmissions(assignmentId: number) {
  const results = await db.manyOrNone<{ canvas_object: unknown }>(
    `SELECT canvas_object 
    FROM submissions 
    WHERE assignment_id = $<assignmentId>
    ORDER BY updated_at DESC`,
    { assignmentId }
  );
  return results.map((r) =>
    parseSchema(
      CanvasSubmissionSchema,
      r.canvas_object,
      "CanvasSubmission from DB"
    )
  );
}

export async function storeAttachments(
  attachments: Array<{ id: number; submissionId: number; filepath: string }>
) {

  const queries = attachments.map((attachment) =>
    db.none(
      `
      INSERT INTO submission_attachments (id, submission_id, filepath)
      VALUES ($<id>, $<submissionId>, $<filepath>)
      ON CONFLICT (id) 
      DO UPDATE SET 
        submission_id = EXCLUDED.submission_id,
        filepath = EXCLUDED.filepath
      `,
      {
        id: attachment.id,
        submissionId: attachment.submissionId,
        filepath: attachment.filepath,
      }
    )
  );

  await Promise.all(queries);
}

export async function getSubmissionAttachments(submissionId: number) {
  const results = await db.manyOrNone<{ id: number; filepath: string }>(
    `SELECT id, filepath 
    FROM submission_attachments 
    WHERE submission_id = $<submissionId>`,
    { submissionId }
  );
  return results;
}
