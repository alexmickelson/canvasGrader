import { zodFunction, zodResponseFormat } from "openai/helpers/zod.mjs";
import type z from "zod";
import type { ConversationMessage } from "../../server/trpc/routers/rubricAI/rubricAiReportModels";
import { toOpenAIMessage, fromOpenAIMessage } from "../../server/trpc/routers/rubricAI/rubricAiUtils";
import type { AiTool } from "./createAiTool";
import { getOpenaiClient } from "./getOpenaiClient";

export async function getAiCompletion({
  messages,
  model,
  tools,
  responseFormat,
  temperature = 0.1,
}: {
  messages: ConversationMessage[];
  model: string;
  tools?: AiTool[];
  responseFormat?: z.ZodTypeAny;
  temperature?: number;
}): Promise<ConversationMessage> {
  const openai = getOpenaiClient();

  // Convert domain messages to OpenAI format
  const openaiMessages = messages.map(toOpenAIMessage);

  // Prepare tools if provided
  const toolsSchema = tools?.map((tool) =>
    zodFunction({
      name: tool.name,
      description: tool.description,
      parameters: tool.paramsSchema,
    })
  );

  try {
    let completion;

    if (responseFormat) {
      // Use structured output with zodResponseFormat
      completion = await openai.chat.completions.parse({
        model,
        messages: openaiMessages,
        response_format: zodResponseFormat(
          responseFormat,
          "structured_response"
        ),
        tools: toolsSchema,
        temperature,
      });
    } else {
      // Regular completion
      completion = await openai.chat.completions.create({
        model,
        messages: openaiMessages,
        tools: toolsSchema,
        temperature,
      });
    }

    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error("No response from AI service");
    }

    // Convert back to domain model and return
    return fromOpenAIMessage(assistantMessage);
  } catch (error) {
    console.error("OpenAI API call failed:", error);
    throw new Error(`AI completion failed: ${error}`);
  }
}
