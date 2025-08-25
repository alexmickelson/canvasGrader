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
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";
const canvasToken = process.env.CANVAS_TOKEN;
if (!canvasToken) {
  throw new Error(
    "Canvas token is not set. Please set the CANVAS_TOKEN environment variable."
  );
}

const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

// Helper function to check if a submission should be ignored
const isTestStudentSubmission = (submission: { user?: { name?: string } }) => {
  return submission.user?.name === "Test Student";
};

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
    rating_id: z.string().nullable().optional(),
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

      // Filter out submissions from Test Student
      const filteredSubmissions = parsedSubmissions.filter((submission) => {
        if (isTestStudentSubmission(submission)) {
          console.log(
            `Filtering out Test Student submission (ID: ${submission.id})`
          );
          return false;
        }
        return true;
      });

      const filteredCount =
        parsedSubmissions.length - filteredSubmissions.length;
      if (filteredCount > 0) {
        console.log(`Filtered out ${filteredCount} Test Student submission(s)`);
      }

      // console.log(filteredSubmissions);

      await persistSubmissionsToStorage(
        input.courseId,
        input.assignmentId,
        filteredSubmissions
      );

      return filteredSubmissions;
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

      // Skip processing for Test Student submissions
      if (isTestStudentSubmission(submission)) {
        console.log("Skipping Test Student submission");
        return null;
      }

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

  downloadAndOrganizeRepositories: publicProcedure
    .input(
      z.object({
        classroomAssignmentId: z.string(),
        assignmentId: z.number(),
        courseId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const { classroomAssignmentId, assignmentId, courseId } = input;

      console.log("=== GitHub Classroom Download Started ===");
      console.log(`Input parameters:`);
      console.log(`  - Classroom Assignment ID: ${classroomAssignmentId}`);
      console.log(`  - Canvas Assignment ID: ${assignmentId}`);
      console.log(`  - Canvas Course ID: ${courseId}`);

      try {
        // Get course metadata to determine storage path
        console.log(`\n1. Fetching course metadata for courseId: ${courseId}`);
        const courseMeta = await getCourseMeta(courseId);
        if (!courseMeta) {
          throw new Error(`Course with ID ${courseId} not found`);
        }
        console.log(
          `   ✓ Course found: ${courseMeta.courseName} (Term: ${courseMeta.termName})`
        );

        // Create temporary directory for GitHub Classroom downloads
        const tempDir = path.join(process.cwd(), "temp", "github-classroom");
        console.log(`\n2. Creating temporary directory: ${tempDir}`);
        await ensureDir(tempDir);
        console.log(`   ✓ Temporary directory created/verified`);

        // Execute GitHub Classroom clone command
        const cloneCommand = `gh classroom clone student-repos -a ${classroomAssignmentId}`;
        console.log(`\n3. Executing GitHub Classroom clone command:`);
        console.log(`   Command: ${cloneCommand}`);
        console.log(`   Working directory: ${tempDir}`);
        console.log(`   Executing...`);

        const { stdout, stderr } = await execAsync(cloneCommand, {
          cwd: tempDir,
        });

        if (stderr) {
          console.log(`   ⚠️  GitHub CLI warnings/errors:`, stderr);
        }
        if (stdout) {
          console.log(`   ✓ GitHub CLI output:`, stdout);
        }
        console.log(`   ✓ GitHub Classroom clone command completed`);

        // Find the downloaded repositories directory
        console.log(
          `\n4. Scanning for downloaded repository directories in: ${tempDir}`
        );
        const reposDirs = fs
          .readdirSync(tempDir)
          .filter((dir) => fs.statSync(path.join(tempDir, dir)).isDirectory());

        console.log(
          `   Found ${reposDirs.length} directories: ${reposDirs.join(", ")}`
        );

        if (reposDirs.length === 0) {
          throw new Error("No repositories were downloaded");
        }

        // Assume the first directory contains the student repositories
        const reposDir = path.join(tempDir, reposDirs[0]);
        console.log(`   Using repository directory: ${reposDir}`);

        const studentRepos = fs
          .readdirSync(reposDir)
          .filter((dir) => fs.statSync(path.join(reposDir, dir)).isDirectory());

        console.log(`   Found ${studentRepos.length} student repositories:`);
        studentRepos.forEach((repo, index) => {
          console.log(`     ${index + 1}. ${repo}`);
        });

        // Get assignment name for folder structure
        const assignmentDir = path.join(
          storageDirectory,
          courseMeta.termName,
          sanitizeName(`${courseId} - ${courseMeta.courseName}`),
          `Assignment ${assignmentId}`,
          "submissions"
        );

        console.log(`\n5. Setting up target assignment directory:`);
        console.log(`   Path: ${assignmentDir}`);
        await ensureDir(assignmentDir);
        console.log(`   ✓ Assignment submissions directory created/verified`);

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const processedRepos: {
          repoName: string;
          studentName: string;
          status: string;
          reason?: string;
        }[] = [];

        console.log(`\n6. Processing and organizing student repositories:`);
        console.log(`   Total repositories to process: ${studentRepos.length}`);

        // Organize each student repository
        for (const repoName of studentRepos) {
          const repoIndex = studentRepos.indexOf(repoName) + 1;
          console.log(
            `\n   Processing repository ${repoIndex}/${studentRepos.length}: ${repoName}`
          );

          try {
            // Extract student name from repository name (GitHub format is usually assignment-username)
            const parts = repoName.split("-");
            const studentName =
              parts.length > 1 ? parts.slice(1).join("-") : repoName;
            const sanitizedStudentName = sanitizeName(studentName);

            console.log(`     → Raw student name extracted: "${studentName}"`);
            console.log(
              `     → Sanitized student name: "${sanitizedStudentName}"`
            );

            const sourceDir = path.join(reposDir, repoName);
            const targetDir = path.join(assignmentDir, sanitizedStudentName);

            console.log(`     → Source directory: ${sourceDir}`);
            console.log(`     → Target directory: ${targetDir}`);

            // Check if source directory exists and has contents
            const sourceStats = fs.statSync(sourceDir);
            if (!sourceStats.isDirectory()) {
              throw new Error(`Source path is not a directory: ${sourceDir}`);
            }

            const sourceContents = fs.readdirSync(sourceDir);
            console.log(
              `     → Source contains ${
                sourceContents.length
              } items: ${sourceContents.slice(0, 5).join(", ")}${
                sourceContents.length > 5 ? "..." : ""
              }`
            );

            // Create student directory if it doesn't exist
            console.log(`     → Creating target directory...`);
            await ensureDir(targetDir);

            // Check if target directory already has contents
            const existingContents = fs.existsSync(targetDir)
              ? fs.readdirSync(targetDir)
              : [];
            if (existingContents.length > 0) {
              console.log(
                `     → Target directory already contains ${existingContents.length} items (will be overwritten)`
              );
            }

            // Copy repository contents to student folder
            const copyCommand = `cp -r "${sourceDir}"/* "${targetDir}"/`;
            console.log(`     → Executing copy command: ${copyCommand}`);
            await execAsync(copyCommand);

            // Verify the copy was successful
            const copiedContents = fs.readdirSync(targetDir);
            console.log(
              `     → Copy completed. Target now contains ${copiedContents.length} items`
            );

            processedRepos.push({
              repoName,
              studentName: sanitizedStudentName,
              status: "success",
              reason: `Successfully copied ${sourceContents.length} items to ${targetDir}`,
            });

            console.log(
              `     ✅ Successfully organized repository for student: ${sanitizedStudentName}`
            );
            successCount++;
          } catch (error) {
            const errorMsg = `Failed to organize repository ${repoName}: ${
              error instanceof Error ? error.message : String(error)
            }`;
            console.log(`     ❌ Error processing repository ${repoName}:`);
            console.log(`        ${errorMsg}`);

            processedRepos.push({
              repoName,
              studentName: repoName, // fallback to repo name if extraction failed
              status: "error",
              reason: errorMsg,
            });

            errors.push(errorMsg);
            errorCount++;
          }
        }

        console.log(`\n7. Repository processing summary:`);
        console.log(`   ✅ Successful: ${successCount}`);
        console.log(`   ❌ Failed: ${errorCount}`);
        console.log(`   📊 Total processed: ${successCount + errorCount}`);

        if (processedRepos.length > 0) {
          console.log(`\n   Detailed results:`);
          processedRepos.forEach((repo, index) => {
            const statusIcon = repo.status === "success" ? "✅" : "❌";
            console.log(
              `     ${index + 1}. ${statusIcon} ${repo.repoName} → ${
                repo.studentName
              }`
            );
            if (repo.reason) {
              console.log(`        Reason: ${repo.reason}`);
            }
          });
        }

        // Clean up temporary directory
        console.log(`\n8. Cleaning up temporary directory: ${tempDir}`);
        try {
          await execAsync(`rm -rf "${tempDir}"`);
          console.log(`   ✅ Temporary directory cleaned up successfully`);
        } catch (cleanupError) {
          console.log(
            `   ⚠️  Failed to clean up temporary directory:`,
            cleanupError
          );
        }

        const finalMessage = `Successfully organized ${successCount} repositories${
          errorCount > 0 ? ` (${errorCount} errors occurred)` : ""
        }.`;
        console.log(`\n=== GitHub Classroom Download Completed ===`);
        console.log(`Final result: ${finalMessage}`);
        console.log(`Assignment directory: ${assignmentDir}`);

        return {
          success: true,
          message: finalMessage,
          successCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined,
          processedRepositories: processedRepos,
        };
      } catch (error) {
        console.log(`\n❌ === GitHub Classroom Download FAILED ===`);
        console.log(`Error occurred during download and organization process:`);
        console.log(
          `Error type: ${
            error instanceof Error ? error.constructor.name : typeof error
          }`
        );
        console.log(
          `Error message: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        if (error instanceof Error && error.stack) {
          console.log(`Error stack trace:`);
          console.log(error.stack);
        }
        console.log(`Input parameters that caused the error:`);
        console.log(`  - Classroom Assignment ID: ${classroomAssignmentId}`);
        console.log(`  - Canvas Assignment ID: ${assignmentId}`);
        console.log(`  - Canvas Course ID: ${courseId}`);

        throw new Error(
          `Failed to download and organize GitHub Classroom repositories: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),
});
