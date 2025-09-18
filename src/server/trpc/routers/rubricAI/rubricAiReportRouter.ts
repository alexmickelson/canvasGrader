import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc";
import { parseSchema } from "../parseSchema";

import fs from "fs";
import path from "path";
import {
  getMetadataSubmissionDirectory,
  sanitizeName,
} from "../canvas/canvasStorageUtils";
import {
  type FullEvaluation,
  FullEvaluationSchema,
  type AnalyzeRubricCriterionResponse,
} from "./rubricAiReportModels";
import { analyzeRubricCriterion } from "./rubricAiUtils";

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
      })
    )
    .mutation(async ({ input }): Promise<AnalyzeRubricCriterionResponse> => {
      // Use the generator and consume all messages to get the final result
      const generator = analyzeRubricCriterion(input);

      let finalResult: AnalyzeRubricCriterionResponse | undefined;

      // Consume the generator completely
      while (true) {
        const { value, done } = await generator.next();

        if (done) {
          // The value here is the return value of the generator
          finalResult = value;
          break;
        }

        // value here is a yielded ConversationMessage
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
        assignmentId: z.number(),
        assignmentName: z.string(),
        courseName: z.string(),
        termName: z.string(),
        studentName: z.string(),
      })
    )
    .query(async ({ input }): Promise<FullEvaluation[]> => {
      const {
        courseName,
        termName,
        assignmentName,
        assignmentId,
        studentName,
      } = input;

      console.log("=== getAllEvaluations Debug Info ===");
      console.log("Input parameters:", {
        courseName,
        termName,
        assignmentName,
        assignmentId,
        studentName,
      });

      try {
        // Get the submission directory
        const submissionDir = getMetadataSubmissionDirectory({
          termName,
          courseName,
          assignmentId,
          assignmentName,
          studentName,
        });
        const sanitizedStudentName = sanitizeName(studentName);

        // Read all files in the directory
        const files = fs.readdirSync(submissionDir);
        console.log(`Found ${files.length} files in directory:`, files);

        // Filter for evaluation files (format: <student-name>.rubric.<criterion-id>-<timestamp>.json)
        const evaluationFiles = files.filter(
          (file) =>
            file.startsWith(`${sanitizedStudentName}.rubric.`) &&
            file.endsWith(".json")
        );

        console.log("Filter criteria:", {
          startsWith: `${sanitizedStudentName}.rubric.`,
          endsWith: ".json",
        });

        console.log(
          `Found ${evaluationFiles.length} evaluation files:`,
          evaluationFiles
        );

        // Load and parse each evaluation file
        const evaluations: FullEvaluation[] = [];

        if (evaluationFiles.length === 0) {
          console.log("❌ No evaluation files found matching the criteria");
          console.log(
            "Files that didn't match:",
            files.filter(
              (file) =>
                !file.startsWith(`${sanitizedStudentName}.rubric.`) ||
                !file.endsWith(".json")
            )
          );
          return [];
        }

        console.log(`Processing ${evaluationFiles.length} evaluation files...`);

        for (const fileName of evaluationFiles) {
          try {
            console.log(`📁 Processing file: ${fileName}`);
            const filePath = path.join(submissionDir, fileName);
            const content = fs.readFileSync(filePath, "utf-8");

            let evaluationData;
            try {
              evaluationData = JSON.parse(content);
              console.log(`✅ Successfully parsed JSON for: ${fileName}`);
            } catch (error) {
              console.error("❌ Failed to parse evaluation file as JSON:", {
                fileName,
                filePath,
                error: error,
                content: content.substring(0, 500),
              });
              throw new Error(
                `Failed to parse evaluation file as JSON: ${fileName}. Error: ${error}. Content: ${content.substring(
                  0,
                  500
                )}...`
              );
            }

            // Validate the evaluation data against the schema
            let validatedEvaluation;
            try {
              validatedEvaluation = parseSchema(
                FullEvaluationSchema,
                {
                  filePath,
                  fileName,
                  metadata: evaluationData.metadata,
                  conversation: evaluationData.conversation,
                  evaluation: evaluationData.evaluation,
                  submissionPath: evaluationData.submissionPath,
                },
                `FullEvaluation validation for ${fileName}`
              );
              console.log(`✅ Successfully validated schema for: ${fileName}`);
            } catch (error) {
              console.error("❌ FullEvaluationSchema validation failed:", {
                fileName,
                filePath,
                error: error,
                evaluationData: JSON.stringify(evaluationData, null, 2),
              });
              throw new Error(
                `FullEvaluationSchema validation failed for file: ${fileName}. Data: ${JSON.stringify(
                  evaluationData,
                  null,
                  2
                )}. Error: ${error}`
              );
            }

            evaluations.push(validatedEvaluation);
            console.log(`✅ Added evaluation to results: ${fileName}`);
          } catch (error) {
            console.error(
              `❌ Error reading evaluation file ${fileName}:`,
              error
            );
            console.error(
              "Validation error details:",
              error instanceof Error ? error.message : String(error)
            );
            // Continue with other files instead of failing completely
          }
        }

        // Sort by timestamp, newest first
        evaluations.sort((a, b) => {
          const aTime = a.metadata?.timestamp || "";
          const bTime = b.metadata?.timestamp || "";
          return bTime.localeCompare(aTime);
        });

        console.log(
          `✅ Returning ${evaluations.length} evaluations (sorted by timestamp)`
        );
        console.log("=== getAllEvaluations Debug Info End ===");

        return evaluations;
      } catch (error) {
        console.error("❌ Error loading all evaluations:", error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        console.log("=== getAllEvaluations Debug Info End (Error) ===");
        throw new Error(
          `Failed to load evaluations: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),
});
