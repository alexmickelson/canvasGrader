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
  AnalysisResultSchema,
  type FullEvaluation,
  FullEvaluationSchema,
  type ConversationMessage,
} from "./rubricAiReportModels";
import OpenAI from "openai";
import { getAiCompletion } from "../../../../utils/aiUtils/getAiCompletion";
import { aiModel } from "../../../../utils/aiUtils/getOpenaiClient";

// Helper functions to convert between domain model and OpenAI types
export function toOpenAIMessage(
  message: ConversationMessage
): OpenAI.Chat.ChatCompletionMessageParam {
  const baseMessage: Record<string, unknown> = {
    role: message.role,
  };

  if (message.content) {
    // Handle both string content and structured content
    if (typeof message.content === "string") {
      baseMessage.content = message.content;
    } else {
      // Handle array content (for images and mixed content)
      baseMessage.content = message.content.map((item) => {
        if (item.type === "text") {
          return {
            type: "text" as const,
            text: item.text || "",
          };
        } else if (item.type === "image_url") {
          // Convert base64 data to data URL for OpenAI
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
}): AsyncGenerator<
  ConversationMessage,
  {
    conversation: ConversationMessage[];
    result: z.infer<typeof resultSchema>;
  },
  unknown
> {
  const conversationMessages: ConversationMessage[] = [...startingMessages];
  const maxRounds = 10; // Prevent infinite loops
  let round = 0;

  // Yield the starting messages
  for (const message of startingMessages) {
    yield message;
  }

  while (round < maxRounds) {
    round++;

    // Use the reusable completion function
    const assistantMessage = await getAiCompletion({
      messages: conversationMessages,
      tools,
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
      // No tool calls means we're done with this exploration round
      break;
    }

    const continueMessage = {
      role: "user" as const,
      content: `Continue your analysis if you need more information, or provide your final structured JSON analysis when you have gathered enough evidence.`,
    };
    conversationMessages.push(continueMessage);
    yield continueMessage;
  }

  // Add final prompt for structured output
  const finalPromptMessage = {
    role: "user" as const,
    content: `Now please provide your final analysis in the required JSON format. Based on your exploration of the submission files, analyze how well this submission meets the rubric criterion. 

IMPORTANT: Your response must be valid JSON that matches the required schema. Include:
- satisfied: boolean indicating if criterion is met
- confidence: number 0-100 for your confidence level
- recommendedPoints: number of points to award
- explanation: detailed explanation of your assessment
- evidence: array of evidence objects with fileName, fileType, relevantContent, meetsRequirement, confidence, and reasoning
- additionalFilesNeeded: array of any additional files you'd like to examine (optional)

Provide specific file references, line numbers for text files, and page numbers for PDFs, and confidence levels for each piece of evidence.`,
  };
  conversationMessages.push(finalPromptMessage);
  yield finalPromptMessage;

  console.log(
    "About to call OpenAI with zodResponseFormat for structured output"
  );

  // Use the reusable completion function with structured output
  const finalMessage = await getAiCompletion({
    messages: conversationMessages,
    responseFormat: resultSchema,
    temperature: 0.1,
  });

  // Add the final response to conversation and yield it
  conversationMessages.push(finalMessage);
  yield finalMessage;

  // Parse the final result
  if (!finalMessage.content) {
    console.log(finalMessage);
    throw new Error("No content in final response from AI service");
  }

  // Convert content to string if it's an array (shouldn't happen for structured responses, but safety check)
  const contentStr =
    typeof finalMessage.content === "string"
      ? finalMessage.content
      : JSON.stringify(finalMessage.content);

  let parsedResult;
  try {
    parsedResult = JSON.parse(contentStr);
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", {
      error: error,
      content: contentStr,
      contentLength: contentStr.length,
    });
    throw new Error(
      `Failed to parse final response as JSON: ${error}. Content: ${contentStr.substring(
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

  // Return both conversation and result
  return {
    conversation: conversationMessages,
    result,
  };
}

// Generator utility function that yields messages and returns analysis
export async function* analyzeSubmissionWithStreaming({
  textSubmission,
  fileSystemTree,
  criterionDescription,
  criterionPoints,
  tools,
}: {
  submissionDir: string;
  textSubmission: string | null;
  fileSystemTree: string[];
  criterionDescription: string;
  criterionPoints: number;
  tools: AiTool[];
}): AsyncGenerator<ConversationMessage, AnalysisResult, unknown> {
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

  const messages: ConversationMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Please analyze this student submission against the rubric criterion. Start by examining the file system structure and any provided text submission, then use the available tools to read additional files as needed. When you have gathered sufficient evidence, provide your final structured analysis in JSON format without making any more tool calls.`,
    },
  ];

  // Create the generator
  const generator = getRubricAnalysisConversation({
    startingMessages: messages,
    tools,
    resultSchema: AnalysisResultSchema,
  });

  // Yield all messages as they're generated
  for await (const message of generator) {
    yield message;
  }

  // Get the final result
  const generatorResult = await generator.next();
  if (!generatorResult.done || !generatorResult.value) {
    throw new Error("Generator did not complete properly");
  }

  const { result: analysis } = generatorResult.value;

  // Return the analysis result
  return analysis;
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
  termName,
  courseName,
  assignmentName,
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
