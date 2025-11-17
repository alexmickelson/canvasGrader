import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc";
import {
  type FullEvaluation,
  type AnalyzeRubricCriterionResponse,
} from "./rubricAiReportModels";
import { analyzeRubricCriterion } from "./rubricAiUtils";
import { getRubricCriterionAnalysesBySubmission } from "./rubricAiDbUtils";

export const rubricAiReportRouter = createTRPCRouter({
  analyzeRubricCriterion: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        assignmentId: z.number(),
        assignmentName: z.string(),
        studentName: z.string(),
        criterionDescription: z.string(),
        criterionPoints: z.number(),
        criterionId: z.string().optional(),
        termName: z.string(),
        courseName: z.string(),
        submissionId: z.number(),
      })
    )
    .mutation(async ({ input }): Promise<AnalyzeRubricCriterionResponse> => {
      const generator = analyzeRubricCriterion(input);

      let finalResult: AnalyzeRubricCriterionResponse | undefined;

      while (true) {
        const { value, done } = await generator.next();

        if (done) {
          finalResult = value;
          break;
        }

        if (value && "role" in value) {
          console.log(`📤 Processing message: ${value.role}`);
        }
      }

      if (!finalResult) {
        throw new Error("Failed to get analysis result from generator");
      }

      return finalResult;
    }),

  getAllEvaluations: publicProcedure
    .input(
      z.object({
        submissionId: z.number(),
      })
    )
    .query(async ({ input }): Promise<FullEvaluation[]> => {
      const { submissionId } = input;

      const submissions = await getRubricCriterionAnalysesBySubmission(
        submissionId
      );
      return submissions;
    }),
});
