import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc";
import {
  paginatedRequest,
  canvasRequestOptions,
  downloadSubmissionAttachmentsToFolder,
} from "./canvasServiceUtils";
import {
  ensureDir,
  sanitizeName,
  getCourseMeta,
  loadPersistedCourses,
  persistAssignmentsToStorage,
  persistCoursesToStorage,
  persistSubmissionsToStorage,
  persistRubricToStorage,
  getSubmissionDirectory,
} from "./canvasStorageUtils";
import { parseSchema } from "../parseSchema";
import { axiosClient } from "../../../../utils/axiosUtils";
import fs from "fs";
import path from "path";
import {
  prepareTempDir,
  cloneClassroomRepositories,
  discoverRepositories,
  buildGithubLookup,
  computeCleanedPrefix,
  fetchAssignmentName,
  buildAssignmentDir,
  organizeStudentRepositories,
  summarizeAndLog,
  cleanupTempDir,
  type GithubUserMapEntry,
} from "./githubClassroomUtils";
import {
  CanvasRubricSchema,
  CanvasEnrollmentSchema,
  type CanvasCourse,
  CanvasCourseSchema,
  type CanvasAssignment,
  CanvasAssignmentSchema,
  type CanvasSubmission,
  CanvasSubmissionSchema,
  type CanvasRubric,
  type CanvasEnrollment,
} from "./canvasModels";

// execAsync removed (no longer needed after refactor)

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

// Utility function to fetch assignment rubric with proper error handling
const fetchAssignmentRubric = async (
  courseId: number,
  assignmentId: number
): Promise<CanvasRubric> => {
  console.log(
    `Fetching rubric for assignment ${assignmentId} in course ${courseId}`
  );

  try {
    // First, get the assignment to find the rubric association ID
    const { data: assignment } = await axiosClient.get(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
      {
        headers: canvasRequestOptions.headers,
      }
    );

    const rubricId = assignment?.rubric_settings?.id;
    if (!rubricId) {
      throw new Error(
        `No rubric found for assignment ${assignmentId}. Please ensure the assignment has a rubric attached.`
      );
    }

    console.log(`Found rubric ID ${rubricId} for assignment ${assignmentId}`);

    // Fetch the actual rubric data
    const { data: rubric } = await axiosClient.get(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/rubrics/${rubricId}`,
      {
        headers: canvasRequestOptions.headers,
      }
    );

    if (!rubric) {
      throw new Error(
        `Failed to fetch rubric data for rubric ID ${rubricId}. The rubric may have been deleted or access permissions may be insufficient.`
      );
    }

    console.log(`Successfully fetched rubric data for ID ${rubricId}`);

    // Parse and validate the rubric data
    const normalizedRubric = parseSchema(
      CanvasRubricSchema,
      rubric,
      "CanvasRubric"
    );

    // Persist rubric to storage
    await persistRubricToStorage(courseId, assignmentId, normalizedRubric);

    console.log(`Rubric persisted to storage for assignment ${assignmentId}`);

    return normalizedRubric;
  } catch (error) {
    console.error(
      `Error fetching rubric for assignment ${assignmentId}:`,
      error
    );

    // Re-throw with more context if it's our custom error
    if (error instanceof Error && error.message.includes("No rubric found")) {
      throw error;
    }

    // Handle axios errors
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response: { status?: number; data?: unknown };
      };
      throw new Error(
        `Canvas API error (${
          axiosError.response.status
        }): Failed to fetch rubric for assignment ${assignmentId}. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Generic error handling
    throw new Error(
      `Unexpected error fetching rubric for assignment ${assignmentId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export const canvasRouter = createTRPCRouter({
  // Fetch enrollments for a course and store in enrollments.json
  getCourseEnrollments: publicProcedure
    .input(z.object({ courseId: z.coerce.number() }))
    .query(async ({ input }) => {
      const url = `${canvasBaseUrl}/api/v1/courses/${input.courseId}/enrollments?per_page=100`;
      const enrollments = await paginatedRequest<unknown[]>({ url });
      const parsed = enrollments.map((e) =>
        parseSchema(CanvasEnrollmentSchema, e, "CanvasEnrollment")
      );
      // Store in storage/term/courseName/enrollments.json
      const { courseName, termName } = await getCourseMeta(input.courseId);
      const enrollmentsPath = path.join(
        storageDirectory,
        sanitizeName(termName),
        sanitizeName(courseName),
        "enrollments.json"
      );
      await ensureDir(path.dirname(enrollmentsPath));
      fs.writeFileSync(
        enrollmentsPath,
        JSON.stringify(parsed, null, 2),
        "utf8"
      );
      return parsed;
    }),

  // List enrollments from enrollments.json
  listCourseEnrollments: publicProcedure
    .input(z.object({ courseId: z.coerce.number() }))
    .query(async ({ input }): Promise<CanvasEnrollment[]> => {
      const { courseName, termName } = await getCourseMeta(input.courseId);
      const enrollmentsPath = path.join(
        storageDirectory,
        sanitizeName(termName),
        sanitizeName(courseName),
        "enrollments.json"
      );
      if (!fs.existsSync(enrollmentsPath)) {
        // File not present: fetch from Canvas and persist to storage, then return
        const url = `${canvasBaseUrl}/api/v1/courses/${input.courseId}/enrollments?per_page=100`;
        const enrollments = await paginatedRequest<unknown[]>({ url });
        const parsed = enrollments.map((e) =>
          parseSchema(CanvasEnrollmentSchema, e, "CanvasEnrollment")
        );
        await ensureDir(path.dirname(enrollmentsPath));
        fs.writeFileSync(
          enrollmentsPath,
          JSON.stringify(parsed, null, 2),
          "utf8"
        );
        return parsed;
      }

      const data = fs.readFileSync(enrollmentsPath, "utf8");
      return JSON.parse(data);
    }),
  getCourses: publicProcedure.query(async (): Promise<CanvasCourse[]> => {
    // Check if courses are already persisted locally
    const persistedCourses = loadPersistedCourses();

    if (persistedCourses.length > 0) {
      console.log(
        `Found ${persistedCourses.length} persisted courses, skipping Canvas API call`
      );
      return persistedCourses;
    }

    // If no persisted courses found, fetch from Canvas
    console.log("No persisted courses found, fetching from Canvas API");
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
        params: { include: ["submission"] },
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

  downloadAllAttachments: publicProcedure
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
      const submissionDir = getSubmissionDirectory({
        termName,
        courseName,
        assignmentId,
        assignmentName,
        studentName: userName,
      });

      // Instead of generating a preview PDF, download attachments into
      // the student's attachments folder under the submissionDir.
      const attachmentsDir = path.join(submissionDir, "attachments");
      ensureDir(attachmentsDir);

      if (!attachments.length) {
        console.log("No attachments to download for this submission");
        return null;
      }

      console.log("Downloading submission attachments to:", attachmentsDir);
      const downloaded = await downloadSubmissionAttachmentsToFolder(
        submission,
        attachmentsDir
      );

      // Save a manifest of downloaded attachments
      try {
        const manifestPath = path.join(attachmentsDir, "attachments.json");
        fs.writeFileSync(
          manifestPath,
          JSON.stringify(downloaded, null, 2),
          "utf8"
        );
        console.log("Saved attachments manifest to:", manifestPath);
      } catch (err) {
        console.warn("Failed to write attachments manifest:", err);
      }

      type DownloadedAttachment = {
        name?: string;
        filename?: string;
        display_name?: string;
        url?: string;
      };
      const downloadedNames = (downloaded || []).map(
        (d: DownloadedAttachment) =>
          d.name || d.filename || d.display_name || String(d.url || "")
      );
      console.log(`Downloaded ${downloadedNames.length} attachments`);

      return { downloaded: downloadedNames };
    }),

  getAssignmentRubric: publicProcedure
    .input(
      z.object({
        courseId: z.coerce.number(),
        assignmentId: z.coerce.number(),
      })
    )
    .query(async ({ input }): Promise<CanvasRubric> => {
      return await fetchAssignmentRubric(input.courseId, input.assignmentId);
    }),

  downloadAndOrganizeRepositories: publicProcedure
    .input(
      z.object({
        classroomAssignmentId: z.string(),
        assignmentId: z.number(),
        courseId: z.number(),
        githubUserMap: z.array(
          z.object({ studentName: z.string(), githubUsername: z.string() })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const { classroomAssignmentId, assignmentId, courseId, githubUserMap } =
        input;

      console.log("=== GitHub Classroom Download Started ===");
      console.log(`Input parameters:`);
      console.log(`  - Classroom Assignment ID: ${classroomAssignmentId}`);
      console.log(`  - Canvas Assignment ID: ${assignmentId}`);
      console.log(`  - Canvas Course ID: ${courseId}`);

      try {
        console.log(`\n1. Fetching course metadata for courseId: ${courseId}`);
        const courseMeta = await getCourseMeta(courseId);
        if (!courseMeta)
          throw new Error(`Course with ID ${courseId} not found`);

        const tempDir = await prepareTempDir();
        await cloneClassroomRepositories(classroomAssignmentId, tempDir);
        const { reposDir, studentRepos } = discoverRepositories(tempDir);
        const githubLookup = buildGithubLookup(
          githubUserMap as GithubUserMapEntry[]
        );
        const cleanedPrefix = computeCleanedPrefix(studentRepos);
        const assignmentName = await fetchAssignmentName(
          canvasBaseUrl,
          courseId,
          assignmentId
        );
        const assignmentDir = await buildAssignmentDir(
          storageDirectory,
          courseMeta,
          assignmentId,
          assignmentName
        );
        const organizeResult = await organizeStudentRepositories({
          studentRepos,
          reposDir,
          cleanedPrefix,
          githubLookup,
          assignmentDir,
        });
        await cleanupTempDir(tempDir);
        const { output } = summarizeAndLog(organizeResult, assignmentDir);
        return output;
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

  gradeSubmissionWithRubric: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        assignmentId: z.number(),
        userId: z.number(),
        rubricAssessment: z.record(
          z.string(), // criterion ID
          z.object({
            rating_id: z.string().optional(),
            points: z.number().optional(),
            comments: z.string().optional(),
          })
        ),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { courseId, assignmentId, userId, rubricAssessment, comment } =
        input;

      console.log("=== Grading Submission with Rubric ===");
      console.log(`Course ID: ${courseId}`);
      console.log(`Assignment ID: ${assignmentId}`);
      console.log(`User ID: ${userId}`);
      console.log(`Rubric Assessment:`, rubricAssessment);
      if (comment) {
        console.log(`Comment: ${comment}`);
      }

      try {
        // Validate required parameters
        if (!userId) {
          throw new Error("User ID is required for grading");
        }

        console.log(`\n1. Using provided user_id: ${userId}`);

        // Calculate total points from rubric assessment
        const totalPoints = Object.values(rubricAssessment).reduce(
          (sum, criterion) => sum + (criterion.points || 0),
          0
        );

        console.log(`Calculated total points: ${totalPoints}`);

        // Prepare the submission data according to Canvas API documentation
        // Using the PUT /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id endpoint
        const submissionData = {
          // Submission parameters
          submission: {
            posted_grade: totalPoints.toString(), // Convert to string as per API docs
          },
          // Comment parameters (if provided)
          ...(comment && {
            comment: {
              text_comment: comment,
            },
          }),
          // Rubric assessment parameters
          rubric_assessment: Object.fromEntries(
            Object.entries(rubricAssessment).map(
              ([criterionId, assessment]) => [
                criterionId, // Use the criterion ID directly (e.g., "crit1", "_1688")
                {
                  ...(assessment.points !== undefined && {
                    points: assessment.points,
                  }),
                  ...(assessment.rating_id && {
                    rating_id: assessment.rating_id,
                  }),
                  ...(assessment.comments && { comments: assessment.comments }),
                },
              ]
            )
          ),
        };

        console.log(
          "Sending combined submission and rubric data to Canvas API:",
          JSON.stringify(submissionData, null, 2)
        );

        // Use the correct Canvas API endpoint: PUT /courses/:course_id/assignments/:assignment_id/submissions/:user_id
        // This endpoint handles both grading and rubric assessment in a single call
        const submissionUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;
        const submissionResponse = await axiosClient.put(
          submissionUrl,
          submissionData,
          {
            ...canvasRequestOptions,
            params: {
              include: ["user", "rubric_assessment"],
            },
          }
        );

        console.log(
          "Canvas submission API response status:",
          submissionResponse.status
        );
        console.log(
          "Canvas submission API response data:",
          JSON.stringify(submissionResponse.data, null, 2)
        );

        // Refetch the submission to get complete data including user information
        console.log(
          "Refetching submission data to include user information..."
        );
        const refetchUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;
        const refetchResponse = await axiosClient.get(refetchUrl, {
          ...canvasRequestOptions,
          params: {
            include: ["user", "rubric_assessment"],
          },
        });

        console.log("Refetch response status:", refetchResponse.status);

        // Parse and return the updated submission
        const updatedSubmission = parseSchema(
          CanvasSubmissionSchema,
          refetchResponse.data,
          "CanvasSubmission"
        );

        console.log("✅ Successfully graded submission");
        console.log(`Final grade: ${updatedSubmission.score}`);

        return {
          success: true,
          submission: updatedSubmission,
          message: `Successfully graded submission with ${totalPoints} points`,
        };
      } catch (error) {
        console.error("❌ Failed to grade submission:", error);

        if (error instanceof Error) {
          console.error("Error message:", error.message);
          // Check if it's an axios error with response data
          if ("response" in error && error.response) {
            const axiosError = error as {
              response: { status?: number; data?: unknown };
            };
            console.error(
              "Canvas API error status:",
              axiosError.response.status
            );
            console.error("Canvas API error data:", axiosError.response.data);
          }
        }

        throw new Error(
          `Failed to grade submission: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),
});
