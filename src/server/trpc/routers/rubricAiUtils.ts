import zodToJsonSchema from "zod-to-json-schema";
import type { AiTool } from "../../../utils/aiUtils/createAiTool";
import OpenAI from "openai";
import { executeToolCall } from "../../../utils/aiUtils/executeToolCall";
import { z } from "zod";

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
  const toolsSchema = tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.paramsSchema),
    },
  }));

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

  const finalResponse = await openai.chat.completions.create({
    model: model,
    messages: conversationMessages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rubric_analysis",
        schema: zodToJsonSchema(resultSchema),
        strict: true,
      },
    },
    temperature: 0.1,
  });

  const finalMessage = finalResponse.choices[0]?.message;
  if (!finalMessage) {
    throw new Error("No final response from AI service");
  }

  // Parse the final result
  if (!finalMessage.content) {
    throw new Error("No content in final response from AI service");
  }

  let parsedResult;
  try {
    parsedResult = JSON.parse(finalMessage.content);
  } catch (error) {
    throw new Error(`Failed to parse final response as JSON: ${error}`);
  }

  // Validate the result against the schema
  const result = resultSchema.parse(parsedResult);

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

  const explorationResponse = await openai.chat.completions.create({
    model: model,
    messages: conversationMessages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rubric_analysis",
        schema: zodToJsonSchema(resultSchema),
        strict: true,
      },
    },
    tools: toolsSchema,
    tool_choice: "auto",
    temperature: 0.1,
  });

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
}
