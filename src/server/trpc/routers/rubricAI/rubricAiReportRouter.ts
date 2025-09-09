import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import {
  getMetadataSubmissionDirectory,
  getSubmissionDirectory,
  sanitizeName,
} from "../canvas/canvasStorageUtils";
import { createAiTool } from "../../../../utils/aiUtils/createAiTool";
import pdf2pic from "pdf2pic";
import { getAllFilePaths } from "../../utils/fileUtils";
import {
  AnalysisResultSchema,
  type FullEvaluation,
  FullEvaluationSchema,
  type ExistingEvaluationsResponse,
  ExistingEvaluationsResponseSchema,
  AnalyzeRubricCriterionResponseSchema,
  type AnalyzeRubricCriterionResponse,
} from "./rubricAiReportModels";
import {
  getExistingEvaluations,
  getRubricAnalysisConversation,
  handleRubricAnalysisError,
  saveEvaluationResults,
} from "./rubricAiUtils";
import { getOpenaiClient } from "../../../../utils/aiUtils/getOpenaiClient";

// const model = "claude-sonnet-4";
const model = "gpt-5";

// Helper function to extract text from PDF files using OpenAI vision
async function extractTextFromPdf(pdfPath: string): Promise<string> {
  try {
    const openai = getOpenaiClient();

    // Convert PDF to PNG images using pdf2pic with aspect ratio preservation
    const pdfBasename = path.basename(pdfPath, ".pdf");
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 150,
      saveFilename: `${pdfBasename}-page`,
      savePath: path.dirname(pdfPath),
      format: "png",
      height: 1024,
    });

    const results = await convert.bulk(-1, { responseType: "image" });

    // Process each page image
    const pageTranscriptions: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result.path) continue;

      // Read the generated PNG file as base64
      const pngBuffer = fs.readFileSync(result.path);
      const base64Png = pngBuffer.toString("base64");

      // Use OpenAI to transcribe the PNG image
      console.log(`Transcribing page ${i + 1} of PDF: ${pdfPath}`);
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please transcribe this page (${
                  i + 1
                }) from a PDF document to clean, well-formatted Markdown. Include all text content, preserve structure with headers, lists, code blocks, tables, etc. If there are images or diagrams, describe them briefly in [brackets].`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Png}`,
                },
              },
            ],
          },
        ],
      });

      const pageTranscription = response.choices[0]?.message?.content;
      if (pageTranscription) {
        // Save the markdown transcription to a file
        const markdownFileName = `${pdfBasename}-page${i + 1}.md`;
        const markdownPath = path.join(path.dirname(pdfPath), markdownFileName);

        try {
          fs.writeFileSync(markdownPath, pageTranscription, "utf-8");
          console.log(`Saved transcription to: ${markdownFileName}`);
        } catch (writeError) {
          console.warn(
            `Could not save markdown file ${markdownFileName}:`,
            writeError
          );
        }

        pageTranscriptions.push(
          `=== Page ${i + 1} (${pdfBasename}-page${
            i + 1
          }.png) ===\n${pageTranscription}`
        );
      }

      // Keep the PNG file instead of deleting it
      console.log(`Converted page ${i + 1} to: ${path.basename(result.path)}`);
    }

    if (pageTranscriptions.length === 0) {
      return `[Error: No transcription received from AI service for PDF: ${path.basename(
        pdfPath
      )}]`;
    }

    // Combine all page transcriptions
    const fullTranscription = pageTranscriptions.join("\n\n");

    // Add line numbers to the transcription for better referencing
    const lines = fullTranscription.split("\n");
    const numberedText = lines
      .map((line: string, index: number) => `${index + 1}: ${line}`)
      .join("\n");

    return `=== PDF Transcription (${path.basename(
      pdfPath
    )}) ===\n${numberedText}`;
  } catch (error) {
    console.error(`Error transcribing PDF ${pdfPath}:`, error);

    // If it's a vision-related error, provide a more helpful message
    if (
      error instanceof Error &&
      error.message.includes("invalid_request_body")
    ) {
      return `[PDF transcription unavailable: Current AI model (${model}) may not support vision capabilities for PDF analysis. PDF file: ${path.basename(
        pdfPath
      )}]`;
    }

    return `[Error transcribing PDF: ${path.basename(pdfPath)} - ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }
}

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
    .query(async ({ input }) => {
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
        const submissionDir = await getSubmissionDirectory({
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
              return await extractTextFromPdf(filePath);
            } else if (isImageFile(params.fileName)) {
              return `[Image file: ${params.fileName} - Visual analysis not available, but file is present]`;
            } else {
              return readTextFile(filePath);
            }
          },
        });
        const tools = [getFileSystemTreeTool, readFileTool];
        const systemPrompt = `You are an expert academic evaluator analyzing a student submission against a specific rubric criterion.

RUBRIC CRITERION TO EVALUATE:
- Description: ${criterionDescription}
- Maximum Points: ${criterionPoints}

STUDENT SUBMISSION OVERVIEW:
File System Structure:
${fileSystemTree}

${
  textSubmission
    ? `Text Submission Content:
${textSubmission}

`
    : "No text submission found."
}

AVAILABLE TOOLS:
- get_file_system_tree: Get the complete file system structure
- read_file: Read specific files from the submission

EVALUATION PROCESS:
1. Start by examining the file system structure and any text submission provided
2. Use the read_file tool to examine relevant files that might contain evidence for the criterion
3. You can call tools multiple times to explore different files as needed
4. For text files, pay attention to line numbers when referencing specific content
5. For PDFs, reference specific pages when citing evidence
6. For images, note their presence and relevance even though content can't be analyzed
7. Focus on concrete evidence and provide confidence levels for your assessments

Take your time to thoroughly explore the submission before providing your final structured analysis.

Use the available tools to explore the submission thoroughly. When you have gathered sufficient evidence and no longer need to call any tools, your next response will be interpreted as your final structured analysis in JSON format. Include:
- satisfied: boolean indicating if criterion is met
- confidence: number 0-100 for your confidence level
- recommendedPoints: number of points to award
- explanation: detailed explanation of your assessment
- evidence: array of evidence objects with fileName, fileType, relevantContent, meetsRequirement, confidence, and reasoning
- additionalFilesNeeded: array of any additional files you'd like to examine (optional)

Provide specific file references, line numbers for text files, and page numbers for PDFs, and confidence levels for each piece of evidence.
`;

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please analyze this student submission against the rubric criterion. Start by examining the file system structure and any provided text submission, then use the available tools to read additional files as needed. When you have gathered sufficient evidence, provide your final structured analysis in JSON format without making any more tool calls.`,
          },
        ];

        const { conversation, result: analysis } =
          await getRubricAnalysisConversation({
            startingMessages: messages,
            tools,
            model,
            resultSchema: AnalysisResultSchema,
          });

        // Save the evaluation results to a JSON file
        console.log("Saving evaluation results...");
        await saveEvaluationResults({
          courseId,
          assignmentId,
          studentName,
          criterionId,
          criterionDescription,
          conversationMessages: conversation,
          analysis,
          courseName,
          assignmentName,
          termName,
          model,
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
      }
    }),

  getExistingEvaluations: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        assignmentName: z.string(),
        courseName: z.string(),
        termName: z.string(),
        studentName: z.string(),
      })
    )
    .query(async ({ input }) => {
      const {
        courseName,
        termName,
        assignmentName,
        assignmentId,
        studentName,
      } = input;

      try {
        const evaluationFiles = await getExistingEvaluations({
          assignmentId,
          studentName,
          courseName,
          termName,
          assignmentName,
        });

        const evaluations = evaluationFiles.map((filePath) => {
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            let data;
            try {
              data = JSON.parse(content);
            } catch (error) {
              console.error("Failed to parse evaluation file as JSON:", {
                filePath,
                error: error,
                content: content.substring(0, 500),
              });
              throw new Error(
                `Failed to parse evaluation file as JSON: ${filePath}. Error: ${error}`
              );
            }

            // Validate the full evaluation data first
            let validatedEvaluation;
            try {
              validatedEvaluation = FullEvaluationSchema.parse(data);
            } catch (error) {
              console.error("FullEvaluationSchema validation failed:", {
                filePath,
                error: error,
                data: JSON.stringify(data, null, 2),
              });
              throw new Error(
                `FullEvaluationSchema validation failed for file: ${filePath}. Data: ${JSON.stringify(
                  data,
                  null,
                  2
                )}. Error: ${error}`
              );
            }

            return {
              filePath,
              fileName: path.basename(filePath),
              metadata: validatedEvaluation.metadata,
              evaluationSummary: {
                confidence: validatedEvaluation.evaluation.confidence,
                recommendedPoints:
                  validatedEvaluation.evaluation.recommendedPoints,
              },
            };
          } catch (error) {
            console.error(`Error reading evaluation file ${filePath}:`, error);
            return {
              filePath,
              fileName: path.basename(filePath),
              error: "Failed to read evaluation file",
            };
          }
        });

        const response: ExistingEvaluationsResponse = {
          studentName,
          evaluations: evaluations.sort((a, b) => {
            // Sort by timestamp, newest first
            const aTime = "metadata" in a ? a.metadata?.timestamp : "";
            const bTime = "metadata" in b ? b.metadata?.timestamp : "";
            return (bTime || "").localeCompare(aTime || "");
          }),
        };

        return ExistingEvaluationsResponseSchema.parse(response);
      } catch (error) {
        console.error("Error getting existing evaluations:", error);
        throw new Error(
          `Failed to get existing evaluations: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
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
