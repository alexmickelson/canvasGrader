import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc";

import fs from "fs";
import path from "path";
import {
  getMetadataSubmissionDirectory,
  getSubmissionDirectory,
  sanitizeName,
} from "../canvas/canvasStorageUtils";
import { createAiTool } from "../../../../utils/aiUtils/createAiTool";
import { getAllFilePaths } from "../../utils/fileUtils";
import {
  type FullEvaluation,
  FullEvaluationSchema,
  AnalyzeRubricCriterionResponseSchema,
  type AnalyzeRubricCriterionResponse,
  type ConversationMessage,
} from "./rubricAiReportModels";
import {
  handleRubricAnalysisError,
  saveEvaluationResults,
  analyzeSubmissionWithStreaming,
} from "./rubricAiUtils";
import {
  extractTextFromPdf,
  combinePageTranscriptions,
  storeTranscriptionPage,
} from "../../../../utils/aiUtils/extractTextFromPdf";

// Helper function to check if file is an image
function isImageFile(filename: string): boolean {
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
  ];
  return imageExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
}

// Helper function to check if file is a PDF
function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

// Helper function to read text files with line numbers
function readTextFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    return lines.map((line, index) => `${index + 1}: ${line}`).join("\n");
  } catch (error) {
    console.error(`Error reading text file ${filePath}:`, error);
    return `[Error reading file: ${filePath}]`;
  }
}

// Get text submission from submission.json if it exists
function getTextSubmission(submissionDir: string): string | null {
  const submissionJsonPath = path.join(submissionDir, "submission.json");
  if (fs.existsSync(submissionJsonPath)) {
    try {
      const rawData = fs.readFileSync(submissionJsonPath, "utf-8");
      let submissionData;
      try {
        submissionData = JSON.parse(rawData);
      } catch (error) {
        console.error("Failed to parse submission.json as JSON:", {
          submissionJsonPath,
          error: error,
          rawData: rawData.substring(0, 500),
        });
        throw new Error(
          `Failed to parse submission.json as JSON: ${submissionJsonPath}. Error: ${error}. Data: ${rawData.substring(
            0,
            500
          )}...`
        );
      }
      return submissionData.body || null;
    } catch (error) {
      console.error("Error reading submission.json:", error);
      return null;
    }
  }
  return null;
}

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
      const {
        courseId,
        assignmentId,
        studentName,
        criterionDescription,
        criterionPoints,
        criterionId,
        termName,
        courseName,
        assignmentName,
      } = input;

      try {
        // Get submission directory
        const submissionDir = getSubmissionDirectory({
          termName,
          courseName,
          assignmentId,
          assignmentName,
          studentName,
        });

        // Get text submission if available
        const textSubmission = getTextSubmission(submissionDir);

        // Generate initial file system tree
        const fileSystemTree = getAllFilePaths(submissionDir, submissionDir);

        // Create file system exploration tools
        const getFileSystemTreeTool = createAiTool({
          name: "get_file_system_tree",
          description:
            "Get the complete file system tree structure of the submission folder",
          paramsSchema: z.object({}),
          fn: async () => {
            console.log("reading directory", submissionDir);
            console.log("files", fileSystemTree);
            return fileSystemTree;
          },
        });

        const readFileTool = createAiTool({
          name: "read_file",
          description:
            "Read the contents of a specific file from the submission folder",
          paramsSchema: z.object({
            fileName: z
              .string()
              .describe(
                "Name of the file to read (relative to submission folder)"
              ),
          }),
          fn: async (params) => {
            const filePath = path.join(submissionDir, params.fileName);

            if (!fs.existsSync(filePath)) {
              return `Error: File '${params.fileName}' not found in submission folder`;
            }

            const stat = fs.statSync(filePath);
            if (!stat.isFile()) {
              return `Error: '${params.fileName}' is not a file`;
            }

            if (isPdfFile(params.fileName)) {
              const pageTranscriptions = await extractTextFromPdf(filePath);

              // Store each page transcription
              for (const page of pageTranscriptions) {
                await storeTranscriptionPage(
                  filePath,
                  page.pageNumber,
                  page.transcription
                );
              }

              // Return combined transcription for the AI tool
              return combinePageTranscriptions(filePath, pageTranscriptions);
            } else if (isImageFile(params.fileName)) {
              return `[Image file: ${params.fileName} - Visual analysis not available, but file is present]`;
            } else {
              return readTextFile(filePath);
            }
          },
        });
        const tools = [getFileSystemTreeTool, readFileTool];

        // Use the streaming analysis generator
        const analysisGenerator = analyzeSubmissionWithStreaming({
          submissionDir,
          textSubmission,
          fileSystemTree,
          criterionDescription,
          criterionPoints,
          tools,
        });

        // Collect conversation messages as they're yielded
        const conversationMessages: ConversationMessage[] = [];

        // Consume all yielded messages
        for await (const message of analysisGenerator) {
          conversationMessages.push(message);
          // Could stream these to client in real-time here
        }

        // Get the final analysis result
        const analysisResult = await analysisGenerator.next();
        if (!analysisResult.done || !analysisResult.value) {
          throw new Error("Analysis generator did not complete properly");
        }

        const analysis = analysisResult.value;

        // Save the evaluation results to a JSON file
        console.log("Saving evaluation results...");
        await saveEvaluationResults({
          courseId,
          assignmentId,
          studentName,
          criterionId,
          criterionDescription,
          conversationMessages,
          analysis,
          courseName,
          assignmentName,
          termName,
        });

        // Prepare and validate the response
        const responseData: AnalyzeRubricCriterionResponse = {
          analysis,
          submissionPath: submissionDir,
          fileSystemTree,
          textSubmission,
        };

        console.log("Analysis completed successfully:", {
          confidence: analysis.confidence,
          evidenceCount: analysis.evidence.length,
        });

        // Validate the response data before returning
        let validatedResponse;
        try {
          validatedResponse =
            AnalyzeRubricCriterionResponseSchema.parse(responseData);
        } catch (error) {
          console.error(
            "AnalyzeRubricCriterionResponseSchema validation failed:",
            {
              error: error,
              responseData: JSON.stringify(responseData, null, 2),
              analysis: JSON.stringify(analysis, null, 2),
            }
          );
          throw new Error(
            `AnalyzeRubricCriterionResponseSchema validation failed. Response data: ${JSON.stringify(
              responseData,
              null,
              2
            )}. Error: ${error}`
          );
        }

        return validatedResponse;
      } catch (error) {
        handleRubricAnalysisError(error);
        throw error; // This line should never be reached, but satisfies TypeScript
      }
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
              validatedEvaluation = FullEvaluationSchema.parse({
                filePath,
                fileName,
                metadata: evaluationData.metadata,
                conversation: evaluationData.conversation,
                evaluation: evaluationData.evaluation,
                submissionPath: evaluationData.submissionPath,
              });
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
