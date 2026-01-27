import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../../utils/trpc.js";
import {
  paginatedRequest,
  canvasRequestOptions,
} from "../canvasServiceUtils.js";
import {
  type CanvasCourse,
  CanvasCourseSchema,
  CanvasSubmissionSchema,
} from "../canvasModels.js";
import { rateLimitAwareGet } from "../canvasRequestUtils.js";
import { getAllCourses, storeCourses } from "./canvasCourseDbUtils.js";
import { axiosClient } from "../../../../../utils/axiosUtils.js";
import { parseSchema } from "../../parseSchema.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";
const canvasToken = process.env.CANVAS_TOKEN;
if (!canvasToken) {
  throw new Error(
    "Canvas token is not set. Please set the CANVAS_TOKEN environment variable."
  );
}

export const courseRouter = createTRPCRouter({
  getCourses: publicProcedure.query(async (): Promise<CanvasCourse[]> => {
    // Check if courses are already in the database
    const dbCourses = await getAllCourses();

    if (dbCourses.length > 0) {
      console.log(
        `Found ${dbCourses.length} courses in database, skipping Canvas API call`
      );
      return dbCourses;
    }

    // If no courses in database, fetch from Canvas
    console.log("No courses in database, fetching from Canvas API");
    const url = `${canvasBaseUrl}/api/v1/courses?per_page=100`;
    const courses = await paginatedRequest<CanvasCourse[]>({
      url,
      params: { include: "term" },
    });
    const filteredCourses = courses
      .filter((course) => !course.access_restricted_by_date)
      .map((course) => parseSchema(CanvasCourseSchema, course, "CanvasCourse"));

    // Store courses in database
    await storeCourses(filteredCourses);

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

      // Store courses in database
      await storeCourses(filteredCourses);

      console.log(`Successfully refreshed ${filteredCourses.length} courses`);
      return filteredCourses;
    }
  ),

  gradeSubmissionWithRubric: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        assignmentId: z.number(),
        assignmentName: z.string(),
        studentId: z.number(),
        studentName: z.string(),
        termName: z.string(),
        courseName: z.string(),
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
        const refetchResponse = await rateLimitAwareGet(refetchUrl, {
          ...canvasRequestOptions,
          params: {
            include: ["user", "rubric_assessment", "submission_comments"],
          },
        });

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
            include: ["user", "submission_comments"],
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
});
