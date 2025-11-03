import { createTRPCRouter, publicProcedure } from "../../utils/trpc.js";
import { z } from "zod";
import { downloadAllAttachmentsUtil } from "./canvasServiceUtils.js";
import {
  transcribeSubmissionImages,
} from "./canvasStorageUtils.js";
import { getAssignmentSubmissions } from "./course/assignment/assignmentDbUtils.js";

export const attachmentsRouter = createTRPCRouter({
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

      const submissions = await getAssignmentSubmissions(
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

  downloadAllAttachments: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        assignmentId: z.number(),
        userId: z.number(),
        courseName: z.string(),
        assignmentName: z.string(),
        studentName: z.string(),
        termName: z.string(),
      })
    )
    .query(async ({ input }) => {
      return await downloadAllAttachmentsUtil(input);
    }),
});
