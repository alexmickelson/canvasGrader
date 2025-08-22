import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import {
  paginatedRequest,
  canvasRequestOptions,
  downloadSubmissionAttachmentsToFolder,
  renderAttachmentsToPdf,
  renderTextSubmissionToPdf,
} from "./canvasServiceUtils";
import {
  ensureDir,
  sanitizeName,
  getCourseMeta,
  persistAssignmentsToStorage,
  persistCoursesToStorage,
  persistSubmissionsToStorage,
  persistRubricToStorage,
} from "./canvasStorageUtils";
import { parseSchema } from "./parseSchema";
import { axiosClient } from "../../../utils/axiosUtils";
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

export const CanvasSubmissionCommentSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  author_name: z.string().optional(),
  comment: z.string(),
  created_at: z.string(),
  edited_at: z.string().nullable().optional(),
  media_comment: z.any().nullable().optional(),
});

export const CanvasRubricAssessmentSchema = z.record(
  z.string(), // criterion ID keys like "_1688", "_6165"
  z.object({
    rating_id: z.string().optional(),
    comments: z.string().optional(),
    points: z.number().optional(),
  })
);

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
  submission_comments: z
    .array(CanvasSubmissionCommentSchema)
    .nullable()
    .optional(),
  submission_type: z.string().nullable().optional(),

  // Rubric assessment
  rubric_assessment: CanvasRubricAssessmentSchema.nullable().optional(),

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

export const CanvasRubricCriterionSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  long_description: z.string().optional(),
  points: z.number(),
  criterion_use_range: z.boolean().optional(),
  ratings: z.array(
    z.object({
      id: z.string(),
      description: z.string().optional(),
      long_description: z.string().optional(),
      points: z.number(),
    })
  ),
});

export const CanvasRubricSchema = z.object({
  id: z.number(),
  title: z.string(),
  context_id: z.number(),
  context_type: z.string(),
  points_possible: z.number(),
  reusable: z.boolean().optional(),
  read_only: z.boolean().optional(),
  free_form_criterion_comments: z.boolean().nullable().optional(),
  hide_score_total: z.boolean().nullable().optional(),
  data: z.array(CanvasRubricCriterionSchema),
});

export type CanvasRubric = z.infer<typeof CanvasRubricSchema>;
export type CanvasRubricCriterion = z.infer<typeof CanvasRubricCriterionSchema>;
export type CanvasSubmissionComment = z.infer<
  typeof CanvasSubmissionCommentSchema
>;
export type CanvasRubricAssessment = z.infer<
  typeof CanvasRubricAssessmentSchema
>;

export const canvasRouter = createTRPCRouter({
  getCourses: publicProcedure.query(async () => {
    const url = `${canvasBaseUrl}/api/v1/courses?per_page=100`;
    const courses = await paginatedRequest<CanvasCourse[]>({
      url,
      params: { include: "term" },
    });
    const filteredCourses = courses
      .filter((course) => !course.access_restricted_by_date)
      .map((course) => parseSchema(CanvasCourseSchema, course, "CanvasCourse"));

    // Store each course's JSON data in storage/term/courseName/course.json
    await persistCoursesToStorage(filteredCourses);

    return filteredCourses;
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
      const url = `${canvasBaseUrl}/api/v1/courses/${input.courseId}/assignments/${input.assignmentId}/submissions`;
      const submissions = await paginatedRequest<CanvasSubmission[]>({
        url,
        params: {
          include: ["user", "submission_comments", "rubric_assessment"],
        },
      });
      const parsedSubmissions = submissions.map((submission) =>
        parseSchema(CanvasSubmissionSchema, submission, "CanvasSubmission")
      );
      // console.log(parsedSubmissions);

      await persistSubmissionsToStorage(
        input.courseId,
        input.assignmentId,
        parsedSubmissions
      );

      return parsedSubmissions;
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
        body?: string; // Text entry content
        submission_type?: string;
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
      const hasTextEntry = submission.body && submission.body.trim();

      if (!attachments.length && !hasTextEntry) {
        console.log(
          "No attachments or text entry found for this submission, returning null"
        );
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

      // Save submission metadata
      const submissionJsonPath = path.join(submissionDir, "submission.json");
      if (!fs.existsSync(submissionJsonPath)) {
        fs.writeFileSync(
          submissionJsonPath,
          JSON.stringify(submission, null, 2),
          "utf8"
        );
      }

      // Check if preview PDF already exists
      const previewPdfPath = path.join(submissionDir, "preview.pdf");

      if (fs.existsSync(previewPdfPath)) {
        console.log("Found existing preview PDF at:", previewPdfPath);
        const existingPdfBytes = fs.readFileSync(previewPdfPath);
        const pdfBase64 = existingPdfBytes.toString("base64");
        return { pdfBase64 };
      }

      // Download attachments and store them in the structured folder (if any)
      let pdfBytes: Uint8Array;

      if (hasTextEntry && !attachments.length) {
        // Text-only submission - generate PDF from text content
        console.log("Generating PDF from text entry submission");
        pdfBytes = await renderTextSubmissionToPdf(
          submission.body!,
          userName,
          assignmentName
        );
      } else if (attachments.length > 0 && !hasTextEntry) {
        // Attachment-only submission
        console.log("Generating PDF from attachments");
        const downloaded = await downloadSubmissionAttachmentsToFolder(
          submission,
          submissionDir
        );
        pdfBytes = await renderAttachmentsToPdf(downloaded);
      } else if (attachments.length > 0 && hasTextEntry) {
        // Combined submission - create text PDF and merge with attachments
        console.log("Generating PDF from both text entry and attachments");
        const downloaded = await downloadSubmissionAttachmentsToFolder(
          submission,
          submissionDir
        );

        // Create a combined array: text content first, then attachments
        const textPdfBytes = await renderTextSubmissionToPdf(
          submission.body!,
          userName,
          assignmentName
        );

        // Create a "fake" attachment for the text content to merge with other attachments
        const textAttachment = {
          id: undefined,
          name: "Text Entry",
          url: "",
          contentType: "application/pdf",
          bytes: textPdfBytes,
        };

        pdfBytes = await renderAttachmentsToPdf([
          textAttachment,
          ...downloaded,
        ]);
      } else {
        // Fallback (shouldn't reach here due to earlier check)
        throw new Error("No content to generate PDF from");
      }

      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

      // Save the preview PDF to the same folder
      fs.writeFileSync(previewPdfPath, pdfBytes);
      console.log("Generated and saved new preview PDF to:", previewPdfPath);

      return { pdfBase64 };
    }),

  getAssignmentRubric: publicProcedure
    .input(
      z.object({
        courseId: z.coerce.number(),
        assignmentId: z.coerce.number(),
      })
    )
    .query(async ({ input }): Promise<CanvasRubric | null> => {
      try {
        const { data: assignment } = await axiosClient.get(
          `${canvasBaseUrl}/api/v1/courses/${input.courseId}/assignments/${input.assignmentId}`,
          {
            headers: canvasRequestOptions.headers,
          }
        );

        const rubricId = assignment?.rubric_settings?.id;
        if (!rubricId) {
          console.log("No rubric found for assignment", input.assignmentId);
          return null;
        }

        const { data: rubric } = await axiosClient.get(
          `${canvasBaseUrl}/api/v1/courses/${input.courseId}/rubrics/${rubricId}`,
          {
            headers: canvasRequestOptions.headers,
          }
        );

        if (!rubric) {
          console.log("Failed to fetch rubric data for ID", rubricId);
          return null;
        }

        const normalizedRubric = parseSchema(
          CanvasRubricSchema,
          rubric,
          "CanvasRubric"
        );

        // Persist rubric to storage
        await persistRubricToStorage(
          input.courseId,
          input.assignmentId,
          normalizedRubric
        );

        return normalizedRubric;
      } catch (error) {
        console.error("Error fetching rubric:", error);
        return null;
      }
    }),
});
