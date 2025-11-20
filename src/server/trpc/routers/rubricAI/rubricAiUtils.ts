import type { AiTool } from "../../../../utils/aiUtils/createAiTool";
import { executeToolCall } from "../../../../utils/aiUtils/executeToolCall";
import { z } from "zod";
import {
  sanitizeName,
  getSubmissionDirectory,
  imageDescriptionXMLTag,
} from "../canvas/canvasStorageUtils";
import fs from "fs";
import path from "path";
import {
  type AnalysisResult,
  AnalysisResultSchema,
  type FullEvaluation,
  FullEvaluationSchema,
  type ConversationMessage,
  evidenceSchemaPrompt,
  type AnalyzeRubricCriterionResponse,
  AnalyzeRubricCriterionResponseSchema,
} from "./rubricAiReportModels";
import OpenAI from "openai";
import { getAiCompletion } from "../../../../utils/aiUtils/getAiCompletion";
import { aiModel } from "../../../../utils/aiUtils/getOpenaiClient";
import { parseSchema } from "../parseSchema";
import { createAiTool } from "../../../../utils/aiUtils/createAiTool";
import { getAllFilePaths } from "../../utils/fileUtils";
import {
  extractTextFromPdf,
  combinePageTranscriptions,
  storeTranscriptionPage,
} from "../../../../utils/aiUtils/extractTextFromImages";
import { storeRubricCriterionAnalysis } from "./rubricAiDbUtils";
import { getAssignment } from "../canvas/course/assignment/assignmentDbUtils";

// Helper functions to convert between domain model and OpenAI types
export function toOpenAIMessage(
  message: ConversationMessage
): OpenAI.Chat.ChatCompletionMessageParam {
  const baseMessage: Record<string, unknown> = {
    role: message.role,
  };

  if (message.content) {
    if (typeof message.content === "string") {
      baseMessage.content = message.content;
    } else {
      baseMessage.content = message.content.map((item) => {
        if (item.type === "text") {
          return {
            type: "text" as const,
            text: item.text || "",
          };
        } else if (item.type === "image_url") {
          const mediaType = item.image_url?.mediaType || "image/png";
          const dataUrl = `data:${mediaType};base64,${
            item.image_url?.base64 || ""
          }`;
          return {
            type: "image_url" as const,
            image_url: {
              url: dataUrl,
            },
          };
        }
        return item;
      });
    }
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    baseMessage.tool_calls = message.tool_calls.map((tc) => ({
      id: tc.id || "",
      type: "function" as const,
      function: {
        name: tc.function?.name || "",
        arguments: tc.function?.arguments || "",
      },
    }));
  }

  if (message.tool_call_id) {
    baseMessage.tool_call_id = message.tool_call_id;
  }

  return baseMessage as unknown as OpenAI.Chat.ChatCompletionMessageParam;
}

// Function to parse a resultSchema object from a ConversationMessage
export function parseResultFromMessage<T>(
  message: ConversationMessage,
  resultSchema: z.ZodType<T>
): T {
  // Parse the final result
  if (!message.content) {
    console.log(message);
    throw new Error("No content in final response from AI service");
  }

  // Convert content to string if it's an array (shouldn't happen for structured responses, but safety check)
  const contentStr =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  const parsedResult = JSON.parse(contentStr);
  console.log("📋 Parsed AI response:", JSON.stringify(parsedResult, null, 2));

  // Validate the result against the schema
  try {
    const result = parseSchema(
      resultSchema,
      parsedResult,
      "AI response validation"
    );

    return result;
  } catch (error) {
    console.error(
      "Failed to parse AI response:",
      JSON.stringify(message, null, 2)
    );
    throw error;
  }
}

export function fromOpenAIMessage(openaiMessage: unknown): ConversationMessage {
  const msg = openaiMessage as Record<string, unknown>;

  // Handle content conversion from OpenAI format to domain model
  let content: ConversationMessage["content"];
  if (typeof msg.content === "string") {
    content = msg.content;
  } else if (Array.isArray(msg.content)) {
    // Convert OpenAI structured content to our domain model
    content = msg.content.map((item: Record<string, unknown>) => {
      if (item.type === "text") {
        return {
          type: "text" as const,
          text: item.text as string | undefined,
        };
      } else if (item.type === "image_url") {
        // Extract base64 data from data URL if present
        const imageUrl = item.image_url as { url?: string } | undefined;
        const url = imageUrl?.url || "";

        // Parse data URL to extract base64 and media type
        const dataUrlMatch = url.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUrlMatch) {
          return {
            type: "image_url" as const,
            image_url: {
              base64: dataUrlMatch[2],
              mediaType: dataUrlMatch[1],
            },
          };
        } else {
          // Fallback for non-data URLs (shouldn't happen in our use case)
          return {
            type: "image_url" as const,
            image_url: {
              base64: "",
              mediaType: "image/png",
            },
          };
        }
      }
      return {
        type: item.type as "text" | "image_url",
        text: item.text as string | undefined,
        image_url: undefined,
      };
    });
  } else {
    content = undefined;
  }

  return {
    role: msg.role as ConversationMessage["role"],
    content,
    tool_calls: (msg.tool_calls as unknown[])?.map((tc: unknown) => {
      const toolCall = tc as Record<string, unknown>;
      return {
        id: toolCall.id as string,
        type: toolCall.type as string,
        function: toolCall.function as { name: string; arguments?: string },
      };
    }),
    tool_call_id: msg.tool_call_id as string,
  };
}

export async function* getRubricAnalysisConversation({
  startingMessages,
  tools,
  resultSchema,
}: {
  startingMessages: ConversationMessage[];
  tools: AiTool[];
  resultSchema: z.ZodTypeAny;
}): AsyncGenerator<ConversationMessage> {
  const conversationMessages: ConversationMessage[] = [...startingMessages];
  const maxRounds = 10; // Prevent infinite loops
  let round = 0;

  while (round < maxRounds) {
    round++;
    const assistantMessage = await getAiCompletion({
      messages: conversationMessages,
      tools,
      responseFormat: resultSchema,
      temperature: 0.1,
    });

    conversationMessages.push(assistantMessage);
    yield assistantMessage;

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Execute tool calls and add results
      const toolMessages = await Promise.all(
        assistantMessage.tool_calls
          .filter((tc) => tc.id && tc.function?.name) // Filter out incomplete tool calls
          .map((toolCall) => {
            // Use the tool call directly with the generic domain model
            const genericToolCall = {
              id: toolCall.id!,
              type: toolCall.type || "function",
              function: {
                name: toolCall.function!.name,
                arguments: toolCall.function!.arguments || "",
              },
            };
            return executeToolCall(genericToolCall, tools);
          })
      );

      // Add tool messages directly to conversation and yield them
      for (const msg of toolMessages) {
        const toolMessage = {
          role: msg.role,
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        };
        conversationMessages.push(toolMessage);
        yield toolMessage;
      }
    } else {
      // No tool calls means we got structured responses

      return;
    }
  }

  const finalPromptMessage = {
    role: "user" as const,
    content: `Please provide your final analysis of how well this submission meets the rubric criterion. Base your assessment on the files you've examined and provide specific evidence to support your evaluation.`,
  };
  conversationMessages.push(finalPromptMessage);
  yield finalPromptMessage;

  console.log(
    "About to call OpenAI with zodResponseFormat for structured output"
  );

  yield await getAiCompletion({
    messages: conversationMessages,
    responseFormat: resultSchema,
    temperature: 0.1,
  });
}

// Generator utility function that yields messages and returns analysis
export async function* analyzeSubmissionWithStreaming({
  textSubmission,
  fileSystemTree,
  criterionDescription,
  criterionPoints,
  tools,
  assignmentId,
}: {
  submissionDir: string;
  textSubmission: string | null;
  fileSystemTree: string[];
  criterionDescription: string;
  criterionPoints: number;
  tools: AiTool[];
  assignmentId: number;
}): AsyncGenerator<
  ConversationMessage,
  { conversation: ConversationMessage[]; analysis: AnalysisResult }
> {
  const assignment = await getAssignment(assignmentId);
  if (!assignment) {
    throw new Error(`Assignment with ID ${assignmentId} not found`);
  }
  const systemPrompt = `You are an expert academic evaluator analyzing a student submission against a specific rubric criterion.

<AssignmentFromCanvas>
${JSON.stringify(assignment, null, 2)}
</AssignmentFromCanvas>

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

${evidenceSchemaPrompt}

Use the available tools to explore the submission. When you have gathered sufficient evidence and no longer need to call any tools, your next response will be interpreted as your final structured analysis.

Keep your descriptions and summaries short and effective.

When there is doubt, favor giving points to students. Provide caveats and conditions in your description.
`;

  const messages: ConversationMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Please analyze this student submission against the rubric criterion. Start by examining the file system structure and any provided text submission, then use the available tools to read additional files as needed. When you have gathered sufficient evidence, provide your final structured analysis in JSON format without making any more tool calls.`,
    },
  ];

  // Create the generator
  const generator = getRubricAnalysisConversation({
    startingMessages: [...messages],
    tools,
    resultSchema: AnalysisResultSchema,
  });

  // Yield all messages as they're generated
  for await (const message of generator) {
    messages.push(message);
    yield message;
  }

  const parsed = parseResultFromMessage(
    messages[messages.length - 1],
    AnalysisResultSchema
  );
  const analysis: AnalysisResult = {
    ...parsed,
    evidence: parsed.evidence || [],
  };

  return { conversation: messages, analysis };
}

// Helper function to handle rubric analysis errors
export function handleRubricAnalysisError(error: unknown) {
  console.error("Error analyzing rubric criterion:", error);

  // Handle different types of errors with early returns
  if (!(error instanceof Error)) {
    throw new Error(`Failed to analyze rubric criterion: ${String(error)}`);
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

// Save the evaluation results to a JSON file
export async function saveEvaluationResults({
  courseId,
  assignmentId,
  studentName,
  criterionId,
  criterionDescription,
  conversationMessages,
  analysis,
  submissionId,
}: {
  courseId: number;
  assignmentId: number;
  studentName: string;
  criterionId: string | undefined;
  criterionDescription: string;
  conversationMessages: ConversationMessage[];
  analysis: AnalysisResult;
  submissionId: number;
}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sanitizedStudentName = sanitizeName(studentName);
  const criterionIdSafe =
    criterionId || sanitizeName(criterionDescription).slice(0, 20);

  // Create filename: <student-name>.rubric.<rubriccriterionid>-<timestamp>.json
  const fileName = `${sanitizedStudentName}.rubric.${criterionIdSafe}-${timestamp}.json`;

  // Create the evaluation data using the proper schema
  const evaluationData: FullEvaluation = {
    fileName,
    metadata: {
      courseId,
      assignmentId,
      studentName,
      criterionId,
      criterionDescription,
      timestamp: new Date().toISOString(),
      model: aiModel,
    },
    conversation: conversationMessages.map((msg) => {
      const baseMessage = {
        role: msg.role as "system" | "user" | "assistant" | "tool",
        content: typeof msg.content === "string" ? msg.content : undefined,
      };

      // Handle tool calls for assistant messages
      if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls) {
        return {
          ...baseMessage,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: tc.type,
            function:
              "function" in tc && tc.function
                ? {
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  }
                : undefined,
          })),
        };
      }

      // Handle tool call id for tool messages
      if (msg.role === "tool" && "tool_call_id" in msg) {
        return {
          ...baseMessage,
          tool_call_id: msg.tool_call_id,
        };
      }

      return baseMessage;
    }),
    evaluation: analysis,
  };

  // Validate the data against the schema before saving
  const validatedData = parseSchema(
    FullEvaluationSchema,
    evaluationData,
    "Full evaluation data"
  );
  await storeRubricCriterionAnalysis({
    evaluation: validatedData,
    submissionId,
  });
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

// Main utility function to analyze a rubric criterion
export async function* analyzeRubricCriterion({
  courseId,
  assignmentId,
  assignmentName,
  studentName,
  criterionDescription,
  criterionPoints,
  criterionId,
  termName,
  courseName,
  submissionId,
}: {
  courseId: number;
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  criterionDescription: string;
  criterionPoints: number;
  criterionId?: string;
  termName: string;
  courseName: string;
  submissionId: number;
}): AsyncGenerator<ConversationMessage, AnalyzeRubricCriterionResponse> {
  try {
    // Get submission directory
    const submissionDir = getSubmissionDirectory({
      termName,
      courseName,
      assignmentId,
      assignmentName,
      studentName,
    });

    const textSubmission = getTextSubmission(submissionDir);

    const fileSystemTree = getAllFilePaths(submissionDir, submissionDir);

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
      description: `Read the contents of a specific file from the submission folder, 
embedded images been pre-processed to be text with <${imageDescriptionXMLTag}></${imageDescriptionXMLTag}>`,
      paramsSchema: z.object({
        fileName: z
          .string()
          .describe("Name of the file to read (relative to submission folder)"),
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
      assignmentId,
    });

    // Collect conversation messages as they're yielded
    const conversationMessages: ConversationMessage[] = [];
    let analysis: AnalysisResult | null = null;

    try {
      // Yield each message as it comes in and collect them
      for await (const message of analysisGenerator) {
        console.log(
          `📤 Received message: ${message.role} (total: ${
            conversationMessages.length + 1
          })`
        );
        conversationMessages.push(message);
        yield message; // Yield each conversation message
      }

      const parsed = parseResultFromMessage(
        conversationMessages[conversationMessages.length - 1],
        AnalysisResultSchema
      );
      analysis = {
        recommendedPoints: parsed.recommendedPoints,
        description: parsed.description,
        evidence: parsed.evidence || [],
      };
    } catch (error) {
      console.error("💥 Error during generator consumption:");
      throw error;
    }

    if (!analysis) {
      console.error("❌ No analysis result obtained from generator");
      throw new Error("Failed to obtain analysis result from generator");
    }

    console.log("✅ Analysis completed successfully:", {
      conversationLength: conversationMessages.length,
      evidenceCount: analysis.evidence.length,
    });

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
      submissionId,
    });

    // Prepare and validate the response
    const responseData: AnalyzeRubricCriterionResponse = {
      analysis,
      submissionPath: submissionDir,
      fileSystemTree,
      textSubmission,
    };

    console.log("Analysis completed successfully:", {
      evidenceCount: analysis.evidence.length,
    });

    // Validate the response data before returning
    let validatedResponse;
    try {
      validatedResponse = parseSchema(
        AnalyzeRubricCriterionResponseSchema,
        responseData,
        "AnalyzeRubricCriterionResponse validation"
      );
    } catch (error) {
      console.error("AnalyzeRubricCriterionResponseSchema validation failed:", {
        error: error,
        responseData: JSON.stringify(responseData, null, 2),
        analysis: JSON.stringify(analysis, null, 2),
      });
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
}
