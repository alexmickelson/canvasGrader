import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import {
  paginatedRequest,
  canvasRequestOptions,
  downloadSubmissionAttachmentsToFolder,
} from "./canvasServiceUtils";
import { parseSchema } from "./parseSchema";
import { axiosClient } from "../../../utils/axiosUtils";
import { renderAttachmentsToPdf } from "./canvasServiceUtils";
import fs from "fs";
import path from "path";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";
const canvasToken = process.env.CANVAS_TOKEN;
if (!canvasToken) {
  throw new Error(
    "Canvas token is not set. Please set the CANVAS_TOKEN environment variable."
  );
}

const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeName(name: string): string {
  return (name || "")
    .replace(/[\n\r\t]/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

async function getCourseMeta(courseId: number): Promise<{
  courseName: string;
  termName: string;
}> {
  try {
    const { data } = await axiosClient.get(
      `${canvasBaseUrl}/api/v1/courses/${courseId}` as string,
      {
        headers: canvasRequestOptions.headers,
        params: { include: "term" },
      }
    );
    const courseName: string = data?.name || `Course ${courseId}`;
    const rawTerm: string | undefined = data?.term?.name;
    const termName =
      rawTerm && rawTerm !== "The End of Time" ? rawTerm : "Unknown Term";
    return { courseName, termName };
  } catch {
    return { courseName: `Course ${courseId}`, termName: "Unknown Term" };
  }
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

// New: persist assignment folders and metadata to storage
async function persistAssignmentsToStorage(
  courseId: number,
  assignments: CanvasAssignment[]
): Promise<void> {
  // Persist assignment metadata to storage under Term/Course/<ID - Name>/assignment.json
  try {
    const { courseName, termName } = await getCourseMeta(courseId);
    const baseDir = path.join(
      storageDirectory,
      sanitizeName(termName),
      sanitizeName(courseName)
    );
    ensureDir(baseDir);

    await Promise.all(
      assignments.map(async (a) => {
        const assignDir = path.join(
          baseDir,
          sanitizeName(`${a.id} - ${a.name}`)
        );
        ensureDir(assignDir);
        const filePath = path.join(assignDir, "assignment.json");
        try {
          fs.writeFileSync(filePath, JSON.stringify(a, null, 2), "utf8");
        } catch (err) {
          console.warn("Failed to write assignment.json for", a.id, err);
        }
      })
    );
  } catch (err) {
    console.warn("Failed to persist assignments to storage", err);
  }
}

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
      const normalized = assignments.map((assignment) =>
        parseSchema(CanvasAssignmentSchema, assignment, "CanvasAssignment")
      );

      // Persist assignment metadata to storage under Term/Course/<ID - Name>/assignment.json
      await persistAssignmentsToStorage(input.courseId, normalized);

      return normalized;
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
  // Build a preview PDF by fetching the submission and combining its attachments into a single PDF.

  buildPreviewPdf: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        assignmentId: z.number(),
        userId: z.number(),
      })
    )
    .query(async ({ input: { courseId, assignmentId, userId } }) => {
      // Fetch the submission with attachments and user data
      type CanvasAttachment = {
        id: number;
        filename?: string;
        display_name?: string;
        content_type?: string;
        size?: number;
        url: string; // download URL
      };
      type SubmissionWithAttachments = {
        id?: number;
        attachments?: CanvasAttachment[];
        user?: {
          id: number;
          name: string;
        };
      };
      const { data: submission } =
        await axiosClient.get<SubmissionWithAttachments>(
          `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
          {
            headers: canvasRequestOptions.headers,
            params: { include: ["attachments", "user"] },
          }
        );

      console.log("Submission data:", submission);

      const attachments = submission.attachments ?? [];
      if (!attachments.length) {
        console.log("No attachments found for this submission, returning null");
        return null;
      }

      // Get course, assignment, and user metadata for folder structure
      const { courseName, termName } = await getCourseMeta(courseId);
      const { data: assignment } = await axiosClient.get(
        `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
        {
          headers: canvasRequestOptions.headers,
        }
      );
      const assignmentName = assignment?.name || `Assignment ${assignmentId}`;
      const userName = submission.user?.name || `User ${userId}`;

      // Create folder structure: semester/course/assignment/studentName
      // Example: storage/Spring 2025/Online Web Intro/15357295 - Hello World in HTML/John Doe/
      const submissionDir = path.join(
        storageDirectory,
        sanitizeName(termName),
        sanitizeName(courseName),
        sanitizeName(`${assignmentId} - ${assignmentName}`),
        sanitizeName(userName)
      );
      ensureDir(submissionDir);

      // Download attachments and store them in the structured folder
      const downloaded = await downloadSubmissionAttachmentsToFolder(submission, submissionDir);
      
      // Generate PDF preview and save it
      const pdfBytes = await renderAttachmentsToPdf(downloaded);
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
      
      // Save the preview PDF to the same folder
      const previewPdfPath = path.join(submissionDir, "preview.pdf");
      fs.writeFileSync(previewPdfPath, pdfBytes);
      console.log("Saved preview PDF to:", previewPdfPath);
      
      return { pdfBase64 };
    }),
});
