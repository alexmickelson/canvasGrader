import { zodResponseFormat, zodFunction } from "openai/helpers/zod";
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
} from "./rubricAiReportModels";
import OpenAI from "openai";

// Initialize OpenAI client
const aiUrl = process.env.AI_URL;
const aiToken = process.env.AI_TOKEN;
// const model = "claude-sonnet-4";

if (!aiUrl || !aiToken) {
  console.warn(
    "AI_URL and AI_TOKEN environment variables are required for AI features"
  );
}

const openai = new OpenAI({
  apiKey: aiToken,
  baseURL: aiUrl,
});

export async function getRubricAnalysisConversation({
  startingMessages,
  tools,
  model,
  resultSchema,
}: {
  startingMessages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools: AiTool[];
  model: string;
  resultSchema: z.ZodTypeAny;
}): Promise<{
  conversation: OpenAI.Chat.ChatCompletionMessageParam[];
  result: z.infer<typeof resultSchema>;
}> {
  const toolsSchema = tools.map((tool) =>
    zodFunction({
      name: tool.name,
      description: tool.description,
      parameters: tool.paramsSchema,
    })
  );

  const conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...startingMessages,
  ];
  const maxRounds = 10; // Prevent infinite loops
  let round = 0;

  while (round < maxRounds) {
    round++;

    const result = await explorationRound({
      conversationMessages,
      tools,
      toolsSchema,
      model,
      resultSchema,
      round,
    });

    // Add the new messages to the conversation
    conversationMessages.push(...result.newMessages);
    if (result.done) break;
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

  let finalResponse;
  try {
    finalResponse = await openai.chat.completions.parse({
      model: model,
      messages: conversationMessages,
      response_format: zodResponseFormat(resultSchema, "rubric_analysis"),
      temperature: 0.1,
    });
  } catch (error) {
    console.error("OpenAI API call failed:", {
      error: error,
      messageCount: conversationMessages.length,
    });
    throw new Error(`OpenAI API call failed. Error: ${error}`);
  }

  const finalMessage = finalResponse.choices[0]?.message;
  if (!finalMessage) {
    throw new Error("No final response from AI service");
  }

  // Parse the final result - with zodResponseFormat, this should be valid JSON
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

  // Validate the result against the schema - zodResponseFormat should ensure this passes
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

async function explorationRound({
  conversationMessages,
  tools,
  toolsSchema,
  model,
  resultSchema,
  round,
}: {
  conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[];
  tools: AiTool[];
  toolsSchema: OpenAI.Chat.ChatCompletionTool[];
  model: string;
  resultSchema: z.ZodTypeAny;
  round: number;
}): Promise<{
  done: boolean;
  newMessages: OpenAI.Chat.ChatCompletionMessageParam[];
}> {
  console.log(`AI exploration round ${round}`);

  console.log(
    `About to call OpenAI exploration round ${round} with zodResponseFormat`
  );

  let explorationResponse;
  try {
    explorationResponse = await openai.chat.completions.parse({
      model: model,
      messages: conversationMessages,
      response_format: zodResponseFormat(resultSchema, "rubric_analysis"),
      tools: toolsSchema,
      tool_choice: "auto",
      temperature: 0.1,
    });
  } catch (error) {
    console.error(`OpenAI exploration round ${round} API call failed:`, {
      error: error,
      messageCount: conversationMessages.length,
      toolCount: toolsSchema.length,
    });
    throw new Error(
      `OpenAI exploration round ${round} API call failed. Error: ${error}`
    );
  }

  const assistantMessage = explorationResponse.choices[0]?.message;
  if (!assistantMessage) {
    throw new Error("No response from AI service");
  }

  const newMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    assistantMessage,
  ];

  // Check if AI is ready for structured output (no tool calls means it's done exploring)
  if (
    !assistantMessage.tool_calls ||
    assistantMessage.tool_calls.length === 0
  ) {
    return {
      done: true,
      newMessages,
    };
  }

  // Process any tool calls
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    console.log(
      `Processing ${assistantMessage.tool_calls.length} tool calls in round ${round}`
    );

    // Execute all tool calls and collect results
    const toolMessages = await Promise.all(
      assistantMessage.tool_calls.map((toolCall) =>
        executeToolCall(toolCall, tools)
      )
    );

    // Add tool messages to new messages array
    newMessages.push(...toolMessages);

    // Add a message encouraging the AI to continue or finish
    newMessages.push({
      role: "user",
      content: `Continue your analysis if you need more information, or provide your final structured JSON analysis when you have gathered enough evidence.`,
    });
  } else {
    // If no tool calls, the AI is ready to provide structured output
    console.log(
      "AI response without tool calls - ready for structured output:",
      assistantMessage.content?.substring(0, 200) + "..."
    );
    // The response without tool calls will be processed as the final analysis
    return {
      done: true,
      newMessages,
    };
  }

  return {
    done: false,
    newMessages,
  };
} // Helper function to handle rubric analysis errors
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
  conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[];
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
