import { createTRPCRouter, publicProcedure } from "../../../../utils/trpc.js";
import { z } from "zod";
import {
  paginatedRequest,
  downloadAllAttachmentsUtil,
} from "../../canvasServiceUtils.js";
import {
  persistSubmissionsToStorage,
  loadSubmissionsFromStorage,
} from "../../canvasStorageUtils.js";
import {
  fetchSingleSubmissionByIdFromCanvas,
  fetchSubmissionsFromCanvas,
} from "../../canvasSubmissionsUtils.js";
import { fetchAssignmentRubric } from "../../canvasRubricUtils.js";
import { parseSchema } from "../../../parseSchema.js";
import {
  type CanvasAssignment,
  CanvasAssignmentSchema,
  type CanvasSubmission,
  type CanvasRubric,
} from "../../canvasModels.js";
import {
  getCourseAssignments,
  storeAssignments,
  storeSubmissions,
} from "./assignmentDbUtils.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";

export const assignmentsRouter = createTRPCRouter({
  getAssignmentsInCourse: publicProcedure
    .input(z.object({ courseId: z.coerce.number() }))
    .query(async ({ input }): Promise<CanvasAssignment[]> => {
      const assignmentsInDatabase = await getCourseAssignments(input.courseId);
      if (assignmentsInDatabase.length > 0) return assignmentsInDatabase;

      return await fetchAndStoreCanvasAssignments(input.courseId);
    }),
  refreshAssignmentsInCourse: publicProcedure
    .input(z.object({ courseId: z.coerce.number() }))
    .mutation(async ({ input }): Promise<CanvasAssignment[]> => {
      console.log(
        `Force refreshing assignments from Canvas API for course ${input.courseId}`
      );

      return await fetchAndStoreCanvasAssignments(input.courseId);
    }),

  getAssignmentSubmissions: publicProcedure
    .input(
      z.object({
        courseId: z.coerce.number(),
        assignmentId: z.coerce.number(),
        assignmentName: z.string(),
        courseName: z.string(),
        termName: z.string(),
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
        submissions.map(async (submission) => {
          const _downloadedAttachments = await downloadAllAttachmentsUtil({
            courseId: input.courseId,
            assignmentId: input.assignmentId,
            studentName: submission.user.name,
            userId: submission.user_id,
            courseName: input.courseName,
            assignmentName: input.assignmentName,
            termName: input.termName,
          });

          // storeAttachments({
          //   id:
          // });
        })
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
        courseName: z.string(),
        termName: z.string(),
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

      await storeSubmissions(submissions);

      // await persistSubmissionsToStorage(
      //   input.courseId,
      //   input.assignmentId,
      //   submissions,
      //   input.assignmentName
      await Promise.all(
        submissions.map((submission) =>
          downloadAllAttachmentsUtil({
            courseId: input.courseId,
            assignmentId: input.assignmentId,
            userId: submission.user_id,
            assignmentName: input.assignmentName,
            studentName: submission.user.name,
            courseName: input.courseName,
            termName: input.termName,
          })
        )
      );

      return submissions;
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
});
async function fetchAndStoreCanvasAssignments(
  courseId: number
): Promise<CanvasAssignment[]> {
  const url = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments?per_page=100`;
  const assignments = await paginatedRequest<CanvasAssignment[]>({
    url,
    params: { include: ["submission"] },
  });
  const normalized = assignments.map((assignment) =>
    parseSchema(CanvasAssignmentSchema, assignment, "CanvasAssignment")
  );

  await storeAssignments(normalized);

  return normalized;
}
