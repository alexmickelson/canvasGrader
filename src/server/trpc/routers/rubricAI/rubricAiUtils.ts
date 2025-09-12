import type { AiTool } from "../../../../utils/aiUtils/createAiTool";
import { executeToolCall } from "../../../../utils/aiUtils/executeToolCall";
import { z } from "zod";
import {
  getMetadataSubmissionDirectory,
  sanitizeName,
} from "../canvas/canvasStorageUtils";
import fs from "fs";
import path from "path";
import {
  type AnalysisResult,
  type FullEvaluation,
  FullEvaluationSchema,
  type ConversationMessage,
} from "./rubricAiReportModels";
import OpenAI from "openai";
import { getAiCompletion } from "../../../../utils/aiUtils/getAiCompletion";

// Helper functions to convert between domain model and OpenAI types
export function toOpenAIMessage(
  message: ConversationMessage
): OpenAI.Chat.ChatCompletionMessageParam {
  const baseMessage: Record<string, unknown> = {
    role: message.role,
  };

  if (message.content) {
    baseMessage.content = message.content;
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

export function fromOpenAIMessage(openaiMessage: unknown): ConversationMessage {
  const msg = openaiMessage as Record<string, unknown>;
  return {
    role: msg.role as ConversationMessage["role"],
    content: (msg.content as string) || undefined,
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

export async function getRubricAnalysisConversation({
  startingMessages,
  tools,
  model,
  resultSchema,
}: {
  startingMessages: ConversationMessage[];
  tools: AiTool[];
  model: string;
  resultSchema: z.ZodTypeAny;
}): Promise<{
  conversation: ConversationMessage[];
  result: z.infer<typeof resultSchema>;
}> {
  const conversationMessages: ConversationMessage[] = [...startingMessages];
  const maxRounds = 10; // Prevent infinite loops
  let round = 0;

  while (round < maxRounds) {
    round++;

    // Use the reusable completion function
    const assistantMessage = await getAiCompletion({
      messages: conversationMessages,
      model,
      tools,
    });

    conversationMessages.push(assistantMessage);

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

      // Add tool messages directly to conversation (they're already in domain model format)
      toolMessages.forEach((msg) =>
        conversationMessages.push({
          role: msg.role,
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        })
      );
    } else {
      // No tool calls means we're done with this exploration round
      break;
    }

    conversationMessages.push({
      role: "user",
      content: `Continue your analysis if you need more information, or provide your final structured JSON analysis when you have gathered enough evidence.`,
    });
  }

  // Add final prompt for structured output
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

Provide specific file references, line numbers for text files, and page numbers for PDFs, and confidence levels for each piece of evidence.`,
  });

  console.log(
    "About to call OpenAI with zodResponseFormat for structured output"
  );

  // Use the reusable completion function with structured output
  const finalMessage = await getAiCompletion({
    messages: conversationMessages,
    model,
    responseFormat: resultSchema,
    temperature: 0.1,
  });

  // Parse the final result
  if (!finalMessage.content) {
    throw new Error("No content in final response from AI service");
  }

  let parsedResult;
  try {
    parsedResult = JSON.parse(finalMessage.content);
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", {
      error: error,
      content: finalMessage.content,
      contentLength: finalMessage.content.length,
    });
    throw new Error(
      `Failed to parse final response as JSON: ${error}. Content: ${finalMessage.content.substring(
        0,
        500
      )}...`
    );
  }

  // Validate the result against the schema
  let result;
  try {
    result = resultSchema.parse(parsedResult);
  } catch (error) {
    console.error("Schema validation failed:", {
      error: error,
      parsedResult: JSON.stringify(parsedResult, null, 2),
      schema: resultSchema._def,
    });
    throw new Error(`AI service schema validation failed: ${error}`);
  }

  // Add the final response to conversation and return both conversation and result
  conversationMessages.push(finalMessage);
  return {
    conversation: conversationMessages,
    result,
  };
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
} // Get existing evaluation files for a student
export async function getExistingEvaluations({
  termName,
  courseName,
  assignmentId,
  assignmentName,
  studentName,
}: {
  termName: string;
  courseName: string;
  assignmentId: number;
  assignmentName: string;
  studentName: string;
}): Promise<string[]> {
  try {
    const sanitizedStudentName = sanitizeName(studentName);
    const submissionDir = getMetadataSubmissionDirectory({
      termName,
      courseName,
      assignmentId,
      assignmentName,
      studentName,
    });

    console.log("Looking for evaluations in:", {
      submissionDir,
      sanitizedStudentName,
      termName,
      courseName,
      assignmentId,
      assignmentName,
      studentName,
    });

    // Check if the directory exists
    if (!fs.existsSync(submissionDir)) {
      console.log("Submission directory does not exist:", submissionDir);
      return [];
    }

    // Get all files that match the pattern: <student-name>.rubric.*.json
    const allFiles = fs.readdirSync(submissionDir);
    console.log("All files in directory:", allFiles);

    const pattern = new RegExp(
      `^${sanitizedStudentName}\\.rubric\\..+\\.json$`
    );
    console.log("Looking for pattern:", pattern.toString());

    const evaluationFiles = allFiles.filter((file) => file.match(pattern));
    console.log("Found evaluation files:", evaluationFiles);

    return evaluationFiles.map((file) => path.join(submissionDir, file));
  } catch (error) {
    console.error("Error getting existing evaluations:", error);
    return [];
  }
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
  termName,
  courseName,
  assignmentName,
  model,
}: {
  courseId: number;
  assignmentId: number;
  studentName: string;
  criterionId: string | undefined;
  criterionDescription: string;
  conversationMessages: ConversationMessage[];
  analysis: AnalysisResult;
  termName: string;
  courseName: string;
  assignmentName: string;
  model: string;
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

    // Create the evaluation data using the proper schema
    const evaluationData: FullEvaluation = {
      filePath: evaluationFilePath,
      fileName,
      metadata: {
        courseId,
        assignmentId,
        studentName,
        criterionId,
        criterionDescription,
        timestamp: new Date().toISOString(),
        model,
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
      submissionPath: submissionDir,
    };

    // Validate the data against the schema before saving
    const validatedData = FullEvaluationSchema.parse(evaluationData);

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(evaluationFilePath), { recursive: true });

    // Write the evaluation results
    fs.writeFileSync(
      evaluationFilePath,
      JSON.stringify(validatedData, null, 2),
      "utf-8"
    );

    console.log(`Saved evaluation results to: ${evaluationFilePath}`);
  } catch (error) {
    console.error("Error saving evaluation results:", error);
    // Don't throw - this shouldn't break the main analysis
  }
}
