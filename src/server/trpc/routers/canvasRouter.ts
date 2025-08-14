import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { paginatedRequest } from "./canvasServiceUtils";
import { parseSchema } from "./parseSchema";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";
const canvasToken = process.env.CANVAS_TOKEN;
if (!canvasToken) {
  throw new Error(
    "Canvas token is not set. Please set the CANVAS_TOKEN environment variable."
  );
}

export const CanvasTermSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  start_at: z.coerce.string().nullable().default(null),
  end_at: z.coerce.string().nullable().default(null),
});

export const CanvasCourseSchema = z.object({
  id: z.coerce.number(),
  sis_course_id: z.string().nullable().default(null),
  uuid: z.string(),
  integration_id: z.string().nullable().default(null),
  name: z.string(),
  course_code: z.string(),
  workflow_state: z.enum(["unpublished", "available", "completed", "deleted"]),
  enrollment_term_id: z.coerce.number(),
  created_at: z.coerce.string(),
  start_at: z.coerce.string().nullable().default(null),
  end_at: z.coerce.string().nullable().default(null),
  total_students: z.number().nullable().default(null),
  default_view: z.string(),
  needs_grading_count: z.number().nullable().default(null),
  public_description: z.string().nullable().default(null),
  hide_final_grades: z.boolean(),
  original_record: z.any(),
  access_restricted_by_date: z.boolean().nullable().default(null),
  term: CanvasTermSchema,
});

export type CanvasCourse = z.infer<typeof CanvasCourseSchema>;
export type CanvasTerm = z.infer<typeof CanvasTermSchema>;

export const CanvasAssignmentSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().default(null),
  due_at: z.string().nullable().default(null),
  unlock_at: z.string().nullable().default(null),
  lock_at: z.string().nullable().default(null),
  course_id: z.number(),
  html_url: z.string(),
  submission_types: z.array(z.string()),
  has_submitted_submissions: z.boolean(),
  grading_type: z.string(),
  points_possible: z.number().nullable().default(null),
  grading_standard_id: z.number().nullable().default(null),
  published: z.boolean(),
  muted: z.boolean(),
  context_module_id: z.number().nullable().default(null),
});

export type CanvasAssignment = z.infer<typeof CanvasAssignmentSchema>;

export const CanvasSubmissionSchema = z.object({
  // Base identifiers
  id: z.number().optional(),
  assignment_id: z.number(),
  user_id: z.number(),

  // Linked resources
  assignment: z.any().nullable().optional(),
  course: z.any().nullable().optional(),

  // Attempt & content
  attempt: z.number().nullable().optional(),
  body: z.string().nullable().optional(),

  // Grading & score
  grade: z.string().nullable().optional(),
  grade_matches_current_submission: z.boolean().nullable().optional(),
  score: z.number().nullable().optional(),
  grader_id: z.number().nullable().optional(),
  graded_at: z.string().nullable().optional(),

  // Links
  html_url: z.string().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  url: z.string().nullable().optional(),

  // Comments & type
  submission_comments: z.any().nullable().optional(),
  submission_type: z.string().nullable().optional(),

  // Timestamps & status
  submitted_at: z.string().nullable().optional(),
  workflow_state: z.string(),
  late: z.boolean().nullable().optional(),
  missing: z.boolean().nullable().optional(),
  late_policy_status: z
    .enum(["late", "missing", "extended", "none"])
    .nullable()
    .optional(),
  points_deducted: z.number().nullable().optional(),
  seconds_late: z.number().nullable().optional(),

  // Visibility & exceptions
  assignment_visible: z.boolean().nullable().optional(),
  excused: z.boolean().nullable().optional(),
  redo_request: z.boolean().nullable().optional(),

  // Misc
  extra_attempts: z.number().nullable().optional(),
  anonymous_id: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  read_status: z.string().nullable().optional(),

  // User (as embedded object or string; normalized below)
  user: z
    .union([z.string(), z.object({ id: z.number(), name: z.string() })])
    .nullable()
    .optional(),
});
export type CanvasSubmission = z.infer<typeof CanvasSubmissionSchema>;

export const canvasRouter = createTRPCRouter({
  getCourses: publicProcedure.query(async () => {
    const url = `${canvasBaseUrl}/api/v1/courses?per_page=100`;
    const courses = await paginatedRequest<CanvasCourse[]>({
      url,
      params: { include: "term" },
    });
    return courses
      .filter((course) => !course.access_restricted_by_date)
      .map((course) => parseSchema(CanvasCourseSchema, course, "CanvasCourse"));
  }),
  getAssignmentsInCourse: publicProcedure
    .input(z.object({ courseId: z.coerce.number() }))
    .query(async ({ input }) => {
      const url = `${canvasBaseUrl}/api/v1/courses/${input.courseId}/assignments?per_page=100`;
      const assignments = await paginatedRequest<CanvasAssignment[]>({
        url,
        params: { include: "submission" },
      });
      return assignments.map((assignment) =>
        parseSchema(CanvasAssignmentSchema, assignment, "CanvasAssignment")
      );
    }),
  getAssignmentSubmissions: publicProcedure
    .input(
      z.object({
        courseId: z.coerce.number(),
        assignmentId: z.coerce.number(),
      })
    )
    .query(async ({ input }) => {
      const url = `${canvasBaseUrl}/api/v1/courses/${input.courseId}/assignments/${input.assignmentId}/submissions?per_page=100`;
      const submissions = await paginatedRequest<CanvasSubmission[]>({
        url,
        params: { include: "user" },
      });
      return submissions.map((submission) => ({
        ...submission,
        user:
          submission && submission.user
            ? parseSchema(
                z.object({ id: z.number(), name: z.string() }),
                submission.user,
                "CanvasUser"
              )
            : null,
      }));
    }),
});
