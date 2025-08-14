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
});
