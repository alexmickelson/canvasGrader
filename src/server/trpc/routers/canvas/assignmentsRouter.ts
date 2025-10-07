import { createTRPCRouter, publicProcedure } from "../../utils/trpc.js";
import { z } from "zod";
import {
  paginatedRequest,
  downloadAllAttachmentsUtil,
} from "./canvasServiceUtils.js";
import {
  persistAssignmentsToStorage,
  persistSubmissionsToStorage,
  loadSubmissionsFromStorage,
} from "./canvasStorageUtils.js";
import {
  fetchSingleSubmissionByIdFromCanvas,
  fetchSubmissionsFromCanvas,
} from "./canvasSubmissionsUtils.js";
import { fetchAssignmentRubric } from "./canvasRubricUtils.js";
import { parseSchema } from "../parseSchema.js";
import {
  type CanvasAssignment,
  CanvasAssignmentSchema,
  type CanvasSubmission,
  type CanvasRubric,
} from "./canvasModels.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";

export const assignmentsRouter = createTRPCRouter({
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
