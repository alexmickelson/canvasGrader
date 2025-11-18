import { createTRPCRouter, publicProcedure } from "../../utils/trpc.js";
import { z } from "zod";
import { transcribeSubmissionImages } from "./canvasStorageUtils.js";
import { getAssignmentSubmissions } from "./course/assignment/assignmentDbUtils.js";
import { extractAttachmentsFromMarkdown } from "./course/assignment/canvasSubmissionAttachmentUtils.js";
import { parseSchema } from "../parseSchema.js";

export const attachmentsRouter = createTRPCRouter({
  countUntranscribedImages: publicProcedure
    .input(
      z.object({
        assignmentId: z.coerce.number(),
      })
    )
    .query(async ({ input }) => {
      const submissions = await getAssignmentSubmissions(input.assignmentId);

      if (!submissions || submissions.length === 0) {
        return { count: 0 };
      }

      let totalImages = 0;
      for (const submission of submissions) {
        const parsedSubmission = parseSchema(
          z.object({ body: z.string().nullable() }),
          submission,
          "CanvasSubmission"
        );
        const markdown = parsedSubmission.body ?? "";
        const images = extractAttachmentsFromMarkdown(markdown);
        totalImages += images.length;
      }

      return { count: totalImages };
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

      const submissions = await getAssignmentSubmissions(input.assignmentId);

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
});
