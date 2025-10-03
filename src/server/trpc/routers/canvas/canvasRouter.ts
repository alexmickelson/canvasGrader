import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc.js";
import {
  paginatedRequest,
  canvasRequestOptions,
  downloadAllAttachmentsUtil,
  isTestStudentSubmission,
} from "./canvasServiceUtils.js";
import {
  ensureDir,
  sanitizeName,
  getCourseMeta,
  loadPersistedCourses,
  persistAssignmentsToStorage,
  persistCoursesToStorage,
  persistSubmissionsToStorage,
  transcribeSubmissionImages,
  persistRubricToStorage,
  loadSubmissionsFromStorage,
} from "./canvasStorageUtils.js";
import { parseSchema } from "../parseSchema.js";
import { parseClassroomList, parseAssignmentList } from "./githubCliParser.js";
import { axiosClient } from "../../../../utils/axiosUtils.js";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);
import {
  prepareTempDir,
  cloneClassroomRepositories,
  buildGithubLookup,
  organizeStudentRepositories,
  summarizeAndLog,
  cleanupTempDir,
  type GithubUserMapEntry,
} from "./githubClassroomUtils.js";
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
} from "./canvasModels.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";
const canvasToken = process.env.CANVAS_TOKEN;
if (!canvasToken) {
  throw new Error(
    "Canvas token is not set. Please set the CANVAS_TOKEN environment variable."
  );
}

const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

// Helper function to fetch a single submission by user ID
const fetchSingleSubmissionByIdFromCanvas = async (
  courseId: number,
  assignmentId: number,
  userId: number
): Promise<CanvasSubmission | null> => {
  console.log(`Fetching submission for user ID ${userId}`);

  // Fetch the specific submission using the single submission endpoint
  const submissionUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;

  try {
    const { data: submission } = await axiosClient.get(submissionUrl, {
      headers: canvasRequestOptions.headers,
      params: {
        include: ["user", "submission_comments", "rubric_assessment"],
      },
    });

    const parsedSubmission = parseSchema(
      CanvasSubmissionSchema,
      submission,
      "CanvasSubmission"
    );

    // Filter out Test Student submissions
    if (isTestStudentSubmission(parsedSubmission)) {
      console.log(
        `Filtering out Test Student submission (ID: ${parsedSubmission.id})`
      );
      return null;
    }

    return parsedSubmission;
  } catch (error) {
    console.error(`Failed to fetch submission for user ID ${userId}:`, error);
    return null;
  }
};

// Helper function to fetch and process submissions from Canvas API
const fetchSubmissionsFromCanvas = async (
  courseId: number,
  assignmentId: number
): Promise<CanvasSubmission[]> => {
  // Fetch all submissions using the submissions endpoint
  const url = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`;
  const submissions = await paginatedRequest<CanvasSubmission[]>({
    url,
    params: {
      include: ["user", "submission_comments",  "rubric_assessment"],
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

  const filteredCount = parsedSubmissions.length - filteredSubmissions.length;
  if (filteredCount > 0) {
    console.log(`Filtered out ${filteredCount} Test Student submission(s)`);
  }

  return filteredSubmissions;
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
      ensureDir(path.dirname(enrollmentsPath));
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
        ensureDir(path.dirname(enrollmentsPath));
        fs.writeFileSync(
          enrollmentsPath,
          JSON.stringify(parsed, null, 2),
          "utf8"
        );
        return parsed;
      }

      const data = fs.readFileSync(enrollmentsPath, "utf8");
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error("Failed to parse enrollments file as JSON:", {
          enrollmentsPath,
          error: error,
          data: data.substring(0, 500),
        });
        throw new Error(
          `Failed to parse enrollments file as JSON: ${enrollmentsPath}. Error: ${error}. Data: ${data.substring(
            0,
            500
          )}...`
        );
      }
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

  refreshCourses: publicProcedure.mutation(
    async (): Promise<CanvasCourse[]> => {
      console.log("Force refreshing courses from Canvas API");

      const url = `${canvasBaseUrl}/api/v1/courses?per_page=100`;
      const courses = await paginatedRequest<CanvasCourse[]>({
        url,
        params: { include: "term" },
      });
      const filteredCourses = courses
        .filter((course) => !course.access_restricted_by_date)
        .map((course) =>
          parseSchema(CanvasCourseSchema, course, "CanvasCourse")
        );

      // Store each course's JSON data in storage/term/courseName/course.json
      await persistCoursesToStorage(filteredCourses);

      console.log(`Successfully refreshed ${filteredCourses.length} courses`);
      return filteredCourses;
    }
  ),

  getAssignmentsInCourse: publicProcedure
    .input(z.object({ courseId: z.coerce.number() }))
    .query(async ({ input }): Promise<CanvasAssignment[]> => {
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
        assignmentName: z.string(),
      })
    )
    .query(async ({ input }) => {
      // Check if submissions already exist in storage
      console.log(
        `Checking for existing submissions in storage for assignment ${input.assignmentId}`
      );
      const existingSubmissions = await loadSubmissionsFromStorage(
        input.courseId,
        input.assignmentId
      );

      if (existingSubmissions && existingSubmissions.length > 0) {
        console.log(
          `Found ${existingSubmissions.length} existing submissions, returning cached results`
        );
        return existingSubmissions;
      }

      console.log("No existing submissions found, fetching from Canvas API");

      const submissions = await fetchSubmissionsFromCanvas(
        input.courseId,
        input.assignmentId
      );

      await persistSubmissionsToStorage(
        input.courseId,
        input.assignmentId,
        submissions,
        input.assignmentName
      );

      await Promise.all(
        submissions.map((submission) =>
          downloadAllAttachmentsUtil({
            courseId: input.courseId,
            assignmentId: input.assignmentId,
            userId: submission.user_id,
          })
        )
      );
      return submissions;
    }),

  refreshAssignmentSubmissions: publicProcedure
    .input(
      z.object({
        courseId: z.coerce.number(),
        assignmentId: z.coerce.number(),
        assignmentName: z.string(),
        studentName: z.string().optional(),
        studentId: z.coerce.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const logMessage = input.studentId
        ? `Force refreshing submission from Canvas API for student ID ${input.studentId} in assignment ${input.assignmentId}`
        : `Force refreshing submissions from Canvas API for assignment ${input.assignmentId}`;

      console.log(logMessage);

      // Use ternary to determine which function to call and get submissions
      const submissions = input.studentId
        ? await fetchSingleSubmissionByIdFromCanvas(
            input.courseId,
            input.assignmentId,
            input.studentId
          ).then((sub: CanvasSubmission | null) => (sub ? [sub] : []))
        : await fetchSubmissionsFromCanvas(input.courseId, input.assignmentId);

      console.log(
        `Successfully refreshed ${submissions.length} submission${
          submissions.length === 1 ? "" : "s"
        }`
      );

      await persistSubmissionsToStorage(
        input.courseId,
        input.assignmentId,
        submissions,
        input.assignmentName
      );

      await Promise.all(
        submissions.map((submission) =>
          downloadAllAttachmentsUtil({
            courseId: input.courseId,
            assignmentId: input.assignmentId,
            userId: submission.user_id,
          })
        )
      );

      return submissions;
    }),

  transcribeSubmissionImages: publicProcedure
    .input(
      z.object({
        courseId: z.coerce.number(),
        assignmentId: z.coerce.number(),
        assignmentName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(
        `Transcribing submission images for assignment ${input.assignmentId}`
      );

      // Load existing submissions from storage
      const submissions = await loadSubmissionsFromStorage(
        input.courseId,
        input.assignmentId
      );

      if (!submissions || submissions.length === 0) {
        throw new Error(
          "No submissions found. Please refresh submissions first."
        );
      }

      // Transcribe images for all submissions
      await transcribeSubmissionImages(
        input.courseId,
        input.assignmentId,
        submissions,
        input.assignmentName
      );

      console.log(
        `Successfully transcribed images for ${submissions.length} submissions`
      );

      return { transcribedCount: submissions.length };
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
    .query(async ({ input }) => {
      return await downloadAllAttachmentsUtil(input);
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
        termName: z.string(),
        courseName: z.string(),

        assignmentId: z.number(),
        assignmentName: z.string(),

        courseId: z.number(),
        githubUserMap: z.array(
          z.object({ studentName: z.string(), githubUsername: z.string() })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const {
        classroomAssignmentId,
        assignmentId,
        courseId,
        githubUserMap,
        termName,
        courseName,
        assignmentName,
      } = input;

      console.log("=== GitHub Classroom Download Started ===");
      console.log(`Input parameters:`);
      console.log(`  - Classroom Assignment ID: ${classroomAssignmentId}`);
      console.log(`  - Canvas Assignment ID: ${assignmentId}`);
      console.log(`  - Canvas Course ID: ${courseId}`);

      try {
        console.log(`\n1. Fetching course metadata for courseId: ${courseId}`);

        const tempDir = await prepareTempDir();
        const { studentRepos, reposBaseDir } = await cloneClassroomRepositories(
          classroomAssignmentId,
          tempDir
        );
        const githubLookup = buildGithubLookup(
          githubUserMap as GithubUserMapEntry[]
        );
        const organizeResult = await organizeStudentRepositories({
          studentRepos,
          githubLookup,
          termName,
          courseName,
          assignmentId,
          assignmentName,
          reposDir: reposBaseDir,
        });
        await cleanupTempDir(tempDir);
        const { output } = summarizeAndLog(organizeResult);
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
        assignmentName: z.string(),
        studentId: z.number(),
        studentName: z.string(),
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
      const { courseId, assignmentId, studentId, rubricAssessment, comment } =
        input;

      try {
        // Validate required parameters
        if (!studentId) {
          throw new Error("User ID is required for grading");
        }

        console.log(`\n1. Using provided user_id: ${studentId}`);

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
        const submissionUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;
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
        const refetchUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`;
        const refetchResponse = await axiosClient.get(refetchUrl, {
          ...canvasRequestOptions,
          params: {
            include: ["user", "rubric_assessment", "submission_comments",],
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

  submitComment: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        assignmentId: z.number(),
        userId: z.number(),
        comment: z.string().min(1, "Comment cannot be empty"),
      })
    )
    .mutation(async ({ input }) => {
      const { courseId, assignmentId, userId, comment } = input;

      try {
        console.log(`Submitting comment for submission ${userId}...`);
        console.log(`Comment: ${comment}`);

        const submissionData = {
          comment: {
            text_comment: comment,
          },
        };

        // Submit the comment to Canvas
        const submissionUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;
        await axiosClient.put(submissionUrl, submissionData, {
          ...canvasRequestOptions,
          params: {
            include: ["user","submission_comments"],
          },
        });

        console.log("✅ Successfully submitted comment");

        return {
          success: true,
          message: "Comment submitted successfully",
        };
      } catch (error) {
        console.error("❌ Failed to submit comment:", error);
        throw new Error(
          `Failed to submit comment: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),

  // GitHub Classroom queries
  getGitHubClassrooms: publicProcedure.query(async () => {
    try {
      console.log("Fetching GitHub Classrooms...");

      // First check if gh CLI is available
      try {
        await execAsync("gh --version");
      } catch {
        throw new Error("GitHub CLI (gh) is not installed or not in PATH");
      }

      // Check if classroom extension is installed
      try {
        await execAsync("gh classroom --help");
      } catch {
        throw new Error(
          "GitHub Classroom extension is not installed. Run: gh extension install github/gh-classroom"
        );
      }

      const { stdout } = await execAsync("gh classroom list");

      // Parse the output using the dedicated parser function
      const classrooms = parseClassroomList(stdout);

      console.log(`Found ${classrooms.length} classrooms`);
      return classrooms;
    } catch (error) {
      console.error("Error fetching GitHub Classrooms:", error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message);
    }
  }),

  getGitHubClassroomAssignments: publicProcedure
    .input(z.object({ classroomId: z.string() }))
    .query(async ({ input }) => {
      try {
        console.log(
          `Fetching assignments for classroom ${input.classroomId}...`
        );

        // Use the appropriate gh classroom command for assignments
        // Note: The exact command might vary depending on the gh-classroom extension version
        const { stdout } = await execAsync(
          `gh classroom assignments --classroom-id ${input.classroomId}`
        );

        // Parse the output using the dedicated parser function
        const assignments = parseAssignmentList(stdout);

        console.log(
          `Found ${assignments.length} assignments for classroom ${input.classroomId}`
        );
        return assignments;
      } catch (error) {
        console.error("Error fetching GitHub Classroom assignments:", error);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to fetch assignments for classroom ${input.classroomId}. Error: ${message}`
        );
      }
    }),
});
