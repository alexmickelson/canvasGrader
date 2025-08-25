import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { getCourseMeta, sanitizeName } from "./canvasStorageUtils";
import { createAiTool } from "../../../utils/createAiTool";
import * as pdfParse from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

// Initialize OpenAI client
const aiUrl = process.env.AI_URL;
const aiToken = process.env.AI_TOKEN;

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

// Helper function to extract text from PDF files
async function extractTextFromPdf(pdfPath: string): Promise<string> {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfParse.getDocument({ data }).promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item): item is TextItem => "str" in item)
        .map((item, index) => `[line ${index + 1}] ${item.str}`)
        .join(" ");
      fullText += `=== Page ${pageNum} ===\n${pageText}\n\n`;
    }

    return fullText;
  } catch (error) {
    console.error(`Error extracting text from PDF ${pdfPath}:`, error);
    return `[Error reading PDF: ${pdfPath}]`;
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

// Helper function to generate file system tree
function generateFileSystemTree(dirPath: string, prefix: string = ""): string {
  const items = fs.readdirSync(dirPath);
  let tree = "";

  items.forEach((item, index) => {
    const itemPath = path.join(dirPath, item);
    const isLast = index === items.length - 1;
    const currentPrefix = isLast ? "└── " : "├── ";
    const nextPrefix = prefix + (isLast ? "    " : "│   ");

    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      tree += `${prefix}${currentPrefix}📁 ${item}/\n`;
      tree += generateFileSystemTree(itemPath, nextPrefix);
    } else {
      const icon = isImageFile(item) ? "🖼️ " : isPdfFile(item) ? "📄 " : "📝 ";
      tree += `${prefix}${currentPrefix}${icon}${item}\n`;
    }
  });

  return tree;
}

// Helper function to get submission directory
async function getSubmissionDir(
  courseId: number,
  assignmentId: number,
  userId: number
): Promise<string> {
  const { courseName, termName } = await getCourseMeta(courseId);

  // Find the actual assignment directory
  const courseDir = path.join(
    storageDirectory,
    sanitizeName(termName),
    sanitizeName(courseName)
  );
  const assignmentDirs = fs
    .readdirSync(courseDir)
    .filter(
      (dir) =>
        dir.startsWith(`${assignmentId} - `) &&
        fs.statSync(path.join(courseDir, dir)).isDirectory()
    );

  if (assignmentDirs.length === 0) {
    throw new Error(
      `Assignment directory not found for assignment ${assignmentId}`
    );
  }

  const assignmentDir = path.join(courseDir, assignmentDirs[0]);

  // Find user submission folder
  const userDirs = fs.readdirSync(assignmentDir).filter((dir) => {
    const dirPath = path.join(assignmentDir, dir);
    return fs.statSync(dirPath).isDirectory();
  });

  // Try to find the user's folder - this might need adjustment based on actual folder naming
  const userDir =
    userDirs.find((dir) => dir.includes(userId.toString())) || userDirs[0];

  if (!userDir) {
    throw new Error(`User submission folder not found for user ${userId}`);
  }

  const submissionDir = path.join(assignmentDir, userDir);

  if (!fs.existsSync(submissionDir)) {
    throw new Error(`Submission directory not found: ${submissionDir}`);
  }

  return submissionDir;
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

// Define structured output schema for AI analysis
const AnalysisResultSchema = z.object({
  satisfied: z.boolean().describe("Whether the rubric criterion is satisfied"),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence level (0-100) in this assessment"),
  recommendedPoints: z
    .number()
    .min(0)
    .describe("Recommended points to award for this criterion"),
  explanation: z.string().describe("Detailed explanation of the assessment"),
  evidence: z
    .array(
      z.object({
        fileName: z.string().describe("Name of the file containing evidence"),
        fileType: z
          .enum(["text", "pdf", "image", "other"])
          .describe("Type of file"),
        lineNumbers: z
          .array(z.number())
          .optional()
          .describe("Specific line numbers referenced (for text files)"),
        pageNumbers: z
          .array(z.number())
          .optional()
          .describe("Specific page numbers referenced (for PDFs)"),
        relevantContent: z
          .string()
          .describe("The specific content that provides evidence"),
        meetsRequirement: z
          .boolean()
          .describe("Whether this evidence meets the requirement"),
        confidence: z
          .number()
          .min(0)
          .max(100)
          .describe("Confidence in this specific evidence"),
        reasoning: z
          .string()
          .describe(
            "Explanation of how this evidence relates to the criterion"
          ),
      })
    )
    .describe("Array of evidence found in the submission files"),
  additionalFilesNeeded: z
    .array(z.string())
    .optional()
    .describe("List of additional files that should be examined if available"),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const rubricAiReportRouter = createTRPCRouter({
  analyzeRubricCriterion: publicProcedure
    .input(
      z.object({
        courseId: z.number(),
        assignmentId: z.number(),
        userId: z.number(),
        criterionId: z.string(),
        criterionDescription: z.string(),
        criterionPoints: z.number(),
        criterionRatings: z.array(
          z.object({
            id: z.string(),
            description: z.string().optional(),
            points: z.number(),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      const {
        courseId,
        assignmentId,
        userId,
        criterionId,
        criterionDescription,
        criterionPoints,
        criterionRatings,
      } = input;

      if (!openai) {
        throw new Error(
          "AI service not configured. Please set AI_URL and AI_TOKEN environment variables."
        );
      }

      try {
        // Get submission directory
        const submissionDir = await getSubmissionDir(
          courseId,
          assignmentId,
          userId
        );

        // Get text submission if available
        const textSubmission = getTextSubmission(submissionDir);

        // Generate initial file system tree
        const fileSystemTree = generateFileSystemTree(submissionDir);

        // Create file system exploration tools
        const getFileSystemTreeTool = createAiTool({
          name: "get_file_system_tree",
          description:
            "Get the complete file system tree structure of the submission folder",
          paramsSchema: z.object({}),
          fn: async () => {
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

        // Prepare initial system prompt with file system overview
        const systemPrompt = `You are an expert academic evaluator analyzing a student submission against a specific rubric criterion.

RUBRIC CRITERION TO EVALUATE:
- ID: ${criterionId}
- Description: ${criterionDescription}
- Maximum Points: ${criterionPoints}
- Available Ratings: ${criterionRatings
          .map(
            (r) => `${r.points} points: ${r.description || "No description"}`
          )
          .join(", ")}

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

INSTRUCTIONS:
1. First examine the file system structure and any text submission provided
2. Use the read_file tool to examine relevant files that might contain evidence for the criterion
3. For text files, pay attention to line numbers when referencing specific content
4. For PDFs, reference specific pages when citing evidence
5. For images, note their presence and relevance even though content can't be analyzed
6. Provide a structured analysis with specific references to files, line numbers, and page numbers
7. If you need to examine additional files beyond what's initially provided, use the read_file tool
8. Focus on concrete evidence and provide confidence levels for your assessments

Your final response must use structured output format with detailed evidence references.`;

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please analyze this student submission against the rubric criterion. Start by examining the file system structure and any provided text submission, then use the available tools to read additional files as needed. Provide a comprehensive analysis with specific evidence references.`,
          },
        ];

        // First, let the AI explore and gather information with tools
        const explorationResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          tools: [
            {
              type: "function",
              function: {
                name: getFileSystemTreeTool.name,
                description: getFileSystemTreeTool.description,
                parameters: { type: "object", properties: {}, required: [] },
              },
            },
            {
              type: "function",
              function: {
                name: readFileTool.name,
                description: readFileTool.description,
                parameters: {
                  type: "object",
                  properties: {
                    fileName: {
                      type: "string",
                      description: "Name of the file to read",
                    },
                  },
                  required: ["fileName"],
                },
              },
            },
          ],
          tool_choice: "auto",
          temperature: 0.1,
        });

        // Process tool calls
        const updatedMessages = [
          ...messages,
          explorationResponse.choices[0].message,
        ];

        if (explorationResponse.choices[0].message.tool_calls) {
          for (const toolCall of explorationResponse.choices[0].message
            .tool_calls) {
            if (toolCall.type === "function") {
              let result = "";

              if (toolCall.function.name === getFileSystemTreeTool.name) {
                result = await getFileSystemTreeTool.fn("{}");
              } else if (toolCall.function.name === readFileTool.name) {
                result = await readFileTool.fn(toolCall.function.arguments);
              }

              updatedMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              });
            }
          }
        }

        // Now get the final structured analysis
        updatedMessages.push({
          role: "user",
          content: `Based on your exploration of the submission files, please provide your final structured analysis of how well this submission meets the rubric criterion. Include specific file references, line numbers for text files, page numbers for PDFs, and confidence levels for each piece of evidence.`,
        });

        const finalResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: updatedMessages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "rubric_analysis",
              schema: {
                type: "object",
                properties: {
                  satisfied: {
                    type: "boolean",
                    description: "Whether the rubric criterion is satisfied",
                  },
                  confidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    description: "Confidence level (0-100) in this assessment",
                  },
                  recommendedPoints: {
                    type: "number",
                    minimum: 0,
                    description:
                      "Recommended points to award for this criterion",
                  },
                  explanation: {
                    type: "string",
                    description: "Detailed explanation of the assessment",
                  },
                  evidence: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fileName: { type: "string" },
                        fileType: {
                          type: "string",
                          enum: ["text", "pdf", "image", "other"],
                        },
                        lineNumbers: {
                          type: "array",
                          items: { type: "number" },
                          description:
                            "Specific line numbers referenced (for text files)",
                        },
                        pageNumbers: {
                          type: "array",
                          items: { type: "number" },
                          description:
                            "Specific page numbers referenced (for PDFs)",
                        },
                        relevantContent: { type: "string" },
                        meetsRequirement: { type: "boolean" },
                        confidence: {
                          type: "number",
                          minimum: 0,
                          maximum: 100,
                        },
                        reasoning: { type: "string" },
                      },
                      required: [
                        "fileName",
                        "fileType",
                        "relevantContent",
                        "meetsRequirement",
                        "confidence",
                        "reasoning",
                      ],
                    },
                  },
                  additionalFilesNeeded: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "List of additional files that should be examined",
                  },
                },
                required: [
                  "satisfied",
                  "confidence",
                  "recommendedPoints",
                  "explanation",
                  "evidence",
                ],
              },
            },
          },
          temperature: 0.1,
        });

        const analysisContent = finalResponse.choices[0]?.message?.content;
        if (!analysisContent) {
          throw new Error("No analysis response from AI service");
        }

        let analysis: AnalysisResult;
        try {
          analysis = AnalysisResultSchema.parse(JSON.parse(analysisContent));
        } catch (parseError) {
          console.error("Failed to parse AI analysis:", parseError);
          throw new Error("Invalid analysis format from AI service");
        }

        // Find recommended rating based on points
        const recommendedRating =
          criterionRatings.find(
            (r) => r.points === analysis.recommendedPoints
          ) || criterionRatings[criterionRatings.length - 1];

        return {
          criterionId,
          satisfied: analysis.satisfied,
          confidence: analysis.confidence,
          evidence: analysis.evidence,
          explanation: analysis.explanation,
          recommendedRating,
          recommendedPoints: analysis.recommendedPoints,
          submissionPath: submissionDir,
          fileSystemTree,
          textSubmission,
          additionalFilesNeeded: analysis.additionalFilesNeeded || [],
        };
      } catch (error) {
        console.error("Error analyzing rubric criterion:", error);
        throw new Error(
          `Failed to analyze rubric criterion: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),
});
