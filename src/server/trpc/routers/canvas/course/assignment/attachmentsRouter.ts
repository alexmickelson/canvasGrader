import { createTRPCRouter, publicProcedure } from "../../../../utils/trpc.js";
import { z } from "zod";
import {
  getAssignmentSubmissions,
  getSubmissionAttachments,
  storeAttachments,
} from "./assignmentDbUtils.js";
import { transcribeSubmissionAttachment } from "./canvasSubmissionAttachmentUtils.js";

export const attachmentsRouter = createTRPCRouter({
  countUntranscribedImages: publicProcedure
    .input(
      z.object({
        assignmentId: z.coerce.number(),
      }),
    )
    .query(async ({ input }) => {
      const submissions = await getAssignmentSubmissions(input.assignmentId);

      if (!submissions || submissions.length === 0) {
        return { count: 0 };
      }

      const allAttachments = await Promise.all(
        submissions.map((s) => getSubmissionAttachments(s.id)),
      );

      const untranscribedCount = allAttachments
        .flat()
        .filter((attachment) => !attachment.ai_transcription).length;

      return { count: untranscribedCount };
    }),

  transcribeSubmissionImages: publicProcedure
    .input(
      z.object({
        courseId: z.coerce.number(),
        assignmentId: z.coerce.number(),
        assignmentName: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      // need a "refresh all attachments function"
      // storeSubmissionAttachments?
      console.log(
        `Transcribing submission images for assignment ${input.assignmentId}`,
      );

      const submissions = await getAssignmentSubmissions(input.assignmentId);

      if (!submissions || submissions.length === 0) {
        throw new Error(
          "No submissions found. Please refresh submissions first.",
        );
      }

      await Promise.all(
        submissions.map(async (s) => {
          const userAttachments = await getSubmissionAttachments(s.id);

          const transcribedAttachments = await Promise.all(
            userAttachments
              .filter((a) => !a.ai_transcription)
              .map(async (attachment) => {
                const aiTranscription =
                  await transcribeSubmissionAttachment(attachment);
                return {
                  ...attachment,
                  ai_transcription: aiTranscription,
                };
              }),
          );

          await storeAttachments(transcribedAttachments);
        }),
      );

      console.log(
        `Successfully transcribed images for ${submissions.length} submissions`,
      );
    }),

  getSubmissionAttachments: publicProcedure
    .input(
      z.object({
        submissionId: z.coerce.number(),
      }),
    )
    .query(async ({ input }) => {
      const attachments = await getSubmissionAttachments(input.submissionId);
      return attachments;
    }),
});
