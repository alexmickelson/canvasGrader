import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import {
  getMetadataSubmissionDirectory,
  getSubmissionDirectory,
  sanitizeName,
} from "./canvas/canvasStorageUtils";
import { createAiTool } from "../../../utils/aiUtils/createAiTool";
import pdf2pic from "pdf2pic";
import { getAllFilePaths } from "../utils/fileUtils";
import {
  AnalysisResultSchema,
} from "./rubricAiReportModels";
import { getRubricAnalysisConversation } from "./rubricAiUtils";

// Initialize OpenAI client
const aiUrl = process.env.AI_URL;
const aiToken = process.env.AI_TOKEN;

// const model = "claude-sonnet-4";
const model = "gpt-5";

if (!aiUrl || !aiToken) {
  console.warn(
    "AI_URL and AI_TOKEN environment variables are required for AI features"
  );
}

const openai =
  aiUrl && aiToken
    ? new OpenAI({
        apiKey: aiToken,
        baseURL: aiUrl,
      })
    : null;

// Helper function to extract text from PDF files using OpenAI vision
async function extractTextFromPdf(pdfPath: string): Promise<string> {
  try {
    if (!openai) {
      return `[PDF analysis unavailable: AI service not configured]`;
    }

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
      const submissionData = JSON.parse(
        fs.readFileSync(submissionJsonPath, "utf-8")
      );
      return submissionData.body || null;
    } catch (error) {
      console.error("Error reading submission.json:", error);
      return null;
    }
  }
  return null;
}

// Save the evaluation results to a JSON file
async function saveEvaluationResults({
  courseId,
  assignmentId,
  studentName,
  criterionId,
  criterionDescription,
  conversationMessages,
  analysis,
  termName,
  courseName,
  assignmentName,
}: {
  courseId: number;
  assignmentId: number;
  studentName: string;
  criterionId: string | undefined;
  criterionDescription: string;
  conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[];
  analysis: Record<string, unknown>;
  termName: string;
  courseName: string;
  assignmentName: string;
}) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedStudentName = sanitizeName(studentName);
    const criterionIdSafe =
      criterionId || sanitizeName(criterionDescription).slice(0, 20);

    // Create filename: <student-name>.rubric.<rubriccriterionid>-<timestamp>.json
    const fileName = `${sanitizedStudentName}.rubric.${criterionIdSafe}-${timestamp}.json`;

    // Get the student submission directory to place the file next to it
    const submissionDir = getMetadataSubmissionDirectory({
      termName,
      courseName,
      assignmentId,
      assignmentName,
      studentName,
    });
    const evaluationFilePath = path.join(submissionDir, fileName);

    const evaluationData = {
      metadata: {
        courseId,
        assignmentId,
        studentName,
        criterionId,
        criterionDescription,
        timestamp: new Date().toISOString(),
        model,
      },
      conversation: conversationMessages,
      evaluation: analysis,
      submissionPath: submissionDir,
    };

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(evaluationFilePath), { recursive: true });

    // Write the evaluation results
    fs.writeFileSync(
      evaluationFilePath,
      JSON.stringify(evaluationData, null, 2),
      "utf-8"
    );

    console.log(`Saved evaluation results to: ${evaluationFilePath}`);
  } catch (error) {
    console.error("Error saving evaluation results:", error);
    // Don't throw - this shouldn't break the main analysis
  }
}

// Get existing evaluation files for a student
async function getExistingEvaluations({
  assignmentId,
  studentName,
  courseName,
  termName,
  assignmentName,
}: {
  assignmentId: number;
  studentName: string;
  termName: string;
  courseName: string;
  assignmentName: string;
}): Promise<string[]> {
  try {
    const submissionDir = getSubmissionDirectory({
      termName,
      courseName,
      assignmentId,
      assignmentName,
      studentName,
    });
    const parentDir = path.dirname(submissionDir);
    const sanitizedStudentName = sanitizeName(studentName);

    if (!fs.existsSync(parentDir)) {
      return [];
    }

    const files = fs.readdirSync(parentDir);
    const evaluationFiles = files.filter(
      (file) =>
        file.startsWith(`${sanitizedStudentName}.rubric.`) &&
        file.endsWith(".json")
    );

    return evaluationFiles.map((file) => path.join(parentDir, file));
  } catch (error) {
    console.error("Error getting existing evaluations:", error);
    return [];
  }
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

      if (!openai) {
        throw new Error(
          "AI service not configured. Please set AI_URL and AI_TOKEN environment variables."
        );
      }

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
        // const toolsSchema = [getFileSystemTreeTool, readFileTool].map(
        //   (tool) => ({
        //     type: "function" as const,
        //     function: {
        //       name: tool.name,
        //       description: tool.description,
        //       parameters: zodToJsonSchema(tool.paramsSchema),
        //     },
        //   })
        // );

        // Prepare initial system prompt with file system overview
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

        const {conversation, result: analysis} = await getRubricAnalysisConversation({
        startingMessages: messages,
        tools,
        model,
        resultSchema: AnalysisResultSchema,
      });



        // Parse the AI response using the utility function

        console.log("Successfully parsed AI response");

        // Validate and prepare the response
        const responseData = {
          confidence: analysis.confidence ?? 0,
          evidence: analysis.evidence ?? [],
          recommendedPoints: analysis.recommendedPoints ?? 0,
          description: analysis.description,
          submissionPath: submissionDir,
          fileSystemTree,
          textSubmission,
        };

        console.log("Analysis completed successfully:", {
          confidence: responseData.confidence,
          evidenceCount: responseData.evidence.length,
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
        });

        return responseData;
      } catch (error) {
        console.error("Error analyzing rubric criterion:", error);

        // Handle different types of errors with early returns
        if (!(error instanceof Error)) {
          throw new Error(
            `Failed to analyze rubric criterion: ${String(error)}`
          );
        }

        const message = error.message;

        // OpenAI API schema validation errors
        if (message.includes("Invalid schema for response_format")) {
          console.error("OpenAI Schema Validation Error:");
          console.error(
            "This indicates a mismatch between our Zod schema and OpenAI's strict mode requirements"
          );
          console.error(
            "All properties in the schema must be in the 'required' array for strict mode"
          );
          throw new Error(
            "AI service schema validation failed. Please check that all schema properties are marked as required for OpenAI strict mode."
          );
        }

        // OpenAI API rate limiting
        if (message.includes("429") || message.includes("rate")) {
          throw new Error(
            "AI service rate limit exceeded. Please try again in a few moments."
          );
        }

        // OpenAI API authentication errors
        if (message.includes("401") || message.includes("authentication")) {
          throw new Error(
            "AI service authentication failed. Please check your API key configuration."
          );
        }

        // JSON parsing errors
        if (message.includes("Invalid analysis format")) {
          throw new Error(
            "AI service returned invalid response format. The response could not be parsed as valid JSON matching the expected schema."
          );
        }

        // File system errors
        if (message.includes("ENOENT") || message.includes("no such file")) {
          throw new Error(
            "Submission files not found. Please ensure the student has submitted their assignment and files have been processed."
          );
        }

        // Network or timeout errors
        if (message.includes("timeout") || message.includes("ECONNRESET")) {
          throw new Error(
            "Network timeout while contacting AI service. Please try again."
          );
        }

        // Generic fallback with original error details
        throw new Error(`Failed to analyze rubric criterion: ${message}`);
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
            const data = JSON.parse(content);
            return {
              filePath,
              fileName: path.basename(filePath),
              metadata: data.metadata,
              evaluationSummary: {
                satisfied: data.evaluation?.satisfied,
                confidence: data.evaluation?.confidence,
                recommendedPoints: data.evaluation?.recommendedPoints,
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

        return {
          studentName,
          evaluations: evaluations.sort((a, b) => {
            // Sort by timestamp, newest first
            const aTime = "metadata" in a ? a.metadata?.timestamp : "";
            const bTime = "metadata" in b ? b.metadata?.timestamp : "";
            return (bTime || "").localeCompare(aTime || "");
          }),
        };
      } catch (error) {
        console.error("Error getting existing evaluations:", error);
        throw new Error(
          `Failed to get existing evaluations: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),
});
