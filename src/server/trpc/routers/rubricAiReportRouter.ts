import z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { getCourseMeta, sanitizeName } from "./canvas/canvasStorageUtils";
import { createAiTool } from "../../../utils/createAiTool";
import pdf2pic from "pdf2pic";

const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

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
  studentName: string
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

  console.log(`Looking for student '${studentName}' in directories:`, userDirs);

  // Try to find the student's folder by exact name match
  let userDir = userDirs.find((dir) => dir === studentName);

  // If exact match not found, try case-insensitive match
  if (!userDir) {
    userDir = userDirs.find(
      (dir) => dir.toLowerCase() === studentName.toLowerCase()
    );
  }

  // If still not found, try partial match
  if (!userDir) {
    userDir = userDirs.find(
      (dir) =>
        dir.toLowerCase().includes(studentName.toLowerCase()) ||
        studentName.toLowerCase().includes(dir.toLowerCase())
    );
  }

  if (!userDir) {
    console.error(
      `Student directory not found for '${studentName}' in directories:`,
      userDirs
    );
    throw new Error(
      `Student submission folder not found for '${studentName}'. Available directories: ${userDirs.join(
        ", "
      )}`
    );
  }

  console.log(
    `Found student directory: '${userDir}' for student '${studentName}'`
  );

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
        studentName: z.string(),
        criterionDescription: z.string(),
        criterionPoints: z.number(),
      })
    )
    .query(async ({ input }) => {
      const {
        courseId,
        assignmentId,
        studentName,
        criterionDescription,
        criterionPoints,
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
          studentName
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
        const toolsSchema = [getFileSystemTreeTool, readFileTool].map(
          (tool) => ({
            type: "function" as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: zodToJsonSchema(tool.paramsSchema),
            },
          })
        );

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
7. Once you have gathered sufficient evidence, respond with "READY_FOR_STRUCTURED_OUTPUT" to indicate you're ready for the final assessment
8. Focus on concrete evidence and provide confidence levels for your assessments

Take your time to thoroughly explore the submission before providing your final structured analysis.`;

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please analyze this student submission against the rubric criterion. Start by examining the file system structure and any provided text submission, then use the available tools to read additional files as needed. Provide a comprehensive analysis with specific evidence references. When you're ready to provide your final assessment, respond with "READY_FOR_STRUCTURED_OUTPUT" and I'll ask for your structured analysis.`,
          },
        ];

        // Tool exploration loop - allow multiple rounds of tool usage
        const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          ...messages,
        ];
        const maxRounds = 10; // Prevent infinite loops
        let round = 0;
        let readyForStructuredOutput = false;

        while (!readyForStructuredOutput && round < maxRounds) {
          round++;
          console.log(`AI exploration round ${round}`);

          const explorationResponse = await openai.chat.completions.create({
            model: model,
            messages: conversationMessages,
            tools: toolsSchema,
            tool_choice: "auto",
            temperature: 0.1,
          });

          const assistantMessage = explorationResponse.choices[0]?.message;
          if (!assistantMessage) {
            throw new Error("No response from AI service");
          }

          conversationMessages.push(assistantMessage);

          // Check if AI is ready for structured output
          if (
            assistantMessage.content?.includes("READY_FOR_STRUCTURED_OUTPUT")
          ) {
            readyForStructuredOutput = true;
            break;
          }

          // Process any tool calls
          if (
            assistantMessage.tool_calls &&
            assistantMessage.tool_calls.length > 0
          ) {
            console.log(
              `Processing ${assistantMessage.tool_calls.length} tool calls in round ${round}`
            );

            for (const toolCall of assistantMessage.tool_calls) {
              if (toolCall.type === "function") {
                console.log(`  Tool call: ${toolCall.function.name}`);
                console.log(`  Parameters: ${toolCall.function.arguments}`);

                let result = "";

                if (toolCall.function.name === getFileSystemTreeTool.name) {
                  result = await getFileSystemTreeTool.fn("{}");
                } else if (toolCall.function.name === readFileTool.name) {
                  result = await readFileTool.fn(toolCall.function.arguments);
                }

                console.log(`  Result length: ${result.length} characters`);

                conversationMessages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                });
              }
            }

            // Add a message encouraging the AI to continue or finish
            conversationMessages.push({
              role: "user",
              content: `Continue your analysis if you need more information, or respond with "READY_FOR_STRUCTURED_OUTPUT" when you have gathered enough evidence to provide a comprehensive assessment.`,
            });
          } else {
            // If no tool calls and not ready, prompt for structured output
            console.log(
              "AI response without tool calls or ready signal:",
              assistantMessage.content
            );

            // Add a direct request for structured output
            conversationMessages.push({
              role: "user",
              content: `I need you to provide your final structured analysis now. Based on the information you have, please respond with "READY_FOR_STRUCTURED_OUTPUT" so I can request your structured JSON analysis.`,
            });

            // Give it one more chance, but if it still doesn't respond properly, force exit
            if (round >= 2) {
              readyForStructuredOutput = true; // Force exit after giving it a chance
            }
          }
        }

        if (round >= maxRounds) {
          console.warn(
            `Reached maximum exploration rounds (${maxRounds}), proceeding to structured output`
          );
        }

        // Now get the final structured analysis using Zod schema
        conversationMessages.push({
          role: "user",
          content: `Now please provide your final analysis in the required JSON format. Based on your exploration of the submission files, analyze how well this submission meets the rubric criterion. 

IMPORTANT: Your response must be valid JSON that matches the required schema. Include:
- satisfied: boolean indicating if criterion is met
- confidence: number 0-100 for your confidence level
- recommendedPoints: number of points to award
- explanation: detailed explanation of your assessment
- evidence: array of evidence objects with fileName, fileType, relevantContent, meetsRequirement, confidence, and reasoning
- additionalFilesNeeded: array of any additional files you'd like to examine (optional)

Provide specific file references, line numbers for text files, page numbers for PDFs, and confidence levels for each piece of evidence.`,
        });

        const finalResponse = await openai.chat.completions.create({
          model: model,
          messages: conversationMessages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "rubric_analysis",
              schema: zodToJsonSchema(AnalysisResultSchema),
            },
          },
          temperature: 0.1,
        });

        const analysisContent = finalResponse.choices[0]?.message?.content;
        if (!analysisContent) {
          throw new Error("No analysis response from AI service");
        }

        console.log(
          "Raw AI response content:",
          analysisContent.substring(0, 500) + "..."
        );

        // Clean up the response content - remove markdown code blocks if present
        let cleanContent = analysisContent.trim();

        // Remove markdown json code blocks
        if (
          cleanContent.startsWith("```json") &&
          cleanContent.endsWith("```")
        ) {
          cleanContent = cleanContent.slice(7, -3).trim();
          console.log("Removed markdown json code blocks");
        } else if (
          cleanContent.startsWith("```") &&
          cleanContent.endsWith("```")
        ) {
          cleanContent = cleanContent.slice(3, -3).trim();
          console.log("Removed markdown code blocks");
        }

        let analysis: AnalysisResult;
        try {
          const parsedJson = JSON.parse(cleanContent);
          analysis = AnalysisResultSchema.parse(parsedJson);
        } catch (parseError) {
          console.error(
            "Failed to parse AI analysis. Raw content:",
            analysisContent
          );
          console.error("Cleaned content:", cleanContent);
          console.error("Parse error:", parseError);
          throw new Error("Invalid analysis format from AI service");
        }

        return {
          satisfied: analysis.satisfied,
          confidence: analysis.confidence,
          evidence: analysis.evidence,
          explanation: analysis.explanation,
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
