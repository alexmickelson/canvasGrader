import { zodFunction, zodResponseFormat } from "openai/helpers/zod.mjs";
import type z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ConversationMessage } from "../../server/trpc/routers/rubricAI/rubricAiReportModels";
import {
  toOpenAIMessage,
  fromOpenAIMessage,
} from "../../server/trpc/routers/rubricAI/rubricAiUtils";
import type { AiTool } from "./createAiTool";
import { aiModel, getOpenaiClient } from "./getOpenaiClient";
import { Ollama } from "ollama";

const OLLAMA_URL = process.env.OLLAMA_URL;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;

const provider: "openai" | "ollama" = "openai";
// const provider: "openai" | "ollama" = "ollama";

const ratelimtBackoff = 1000 * 15;

export async function getAiCompletion({
  messages,
  tools,
  responseFormat,
  temperature = 0.1,
  model,
}: {
  messages: ConversationMessage[];
  tools?: AiTool[];
  responseFormat?: z.ZodTypeAny;
  temperature?: number;
  model?: string;
}): Promise<ConversationMessage> {
  if (provider === "ollama") {
    return getOllamaCompletion({
      messages,
      tools,
      responseFormat,
      temperature,
      model,
    });
  }

  return getOpenAiCompletion({
    messages,
    tools,
    responseFormat,
    temperature,
    model,
  });
}

export async function getOllamaCompletion({
  messages,
  tools: _tools,
  responseFormat,
  temperature = 0.1,
  model,
}: {
  messages: ConversationMessage[];
  tools?: AiTool[];
  responseFormat?: z.ZodTypeAny;
  temperature?: number;
  model?: string;
}): Promise<ConversationMessage> {
  const ollama = new Ollama({ host: OLLAMA_URL });

  // Convert domain messages to Ollama format
  const ollamaMessages = messages.map((message) => ({
    role: message.role as "system" | "user" | "assistant",
    content:
      typeof message.content === "string"
        ? message.content
        : message.content
            ?.map((item) => (item.type === "text" ? item.text : "[Image]"))
            .join(" ") || "",
  }));

  // Add instruction for structured output if responseFormat is provided
  if (responseFormat) {
    const lastMessageIndex = ollamaMessages.length - 1;
    if (
      lastMessageIndex >= 0 &&
      ollamaMessages[lastMessageIndex].role === "user"
    ) {
      ollamaMessages[lastMessageIndex].content +=
        "\n\nPlease respond with valid JSON that matches the required schema.";
    }
  }

  // Prepare the chat request
  const chatRequest = {
    model: model ?? OLLAMA_MODEL ?? "gpt-oss:120b",
    messages: ollamaMessages,
    options: {
      temperature,
    },
    stream: false as const,
    ...(responseFormat && {
      format: zodToJsonSchema(responseFormat, "responseSchema"),
    }),
  };

  try {
    const response = await ollama.chat(chatRequest);

    let content = response.message?.content || "";

    // If we have a responseFormat, try to parse and validate the response
    if (responseFormat && content) {
      try {
        const parsed = JSON.parse(content);
        const validated = responseFormat.parse(parsed);
        content = JSON.stringify(validated);
      } catch (parseError) {
        console.warn(
          "Failed to parse/validate structured response from Ollama:",
          parseError
        );
        // Fall back to returning the raw content
      }
    }

    return {
      role: "assistant",
      content,
    };
  } catch (error) {
    console.error("Ollama API call failed:", error);
    throw new Error(`AI completion failed: ${error}`);
  }
}

async function getOpenAiCompletion({
  messages,
  tools,
  responseFormat,
  temperature = 0.1,
  model,
  retryCount = 0,
}: {
  messages: ConversationMessage[];
  tools?: AiTool[];
  responseFormat?: z.ZodTypeAny;
  temperature?: number;
  model?: string;
  retryCount?: number;
}): Promise<ConversationMessage> {
  const MAX_RETRIES = 10;

  try {
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

    let completion;

    if (responseFormat) {
      // Use structured output with zodResponseFormat
      const res = await openai.chat.completions.create({
        model: model ?? aiModel,
        messages: openaiMessages,
        response_format: zodResponseFormat(
          responseFormat,
          "structured_response"
        ),
        tools: toolsSchema,
        temperature,
      });

      completion = res;
      if (responseFormat && res.choices[0]?.message?.content) {
        try {
          const parsed = JSON.parse(res.choices[0].message.content);
          const validated = responseFormat.parse(parsed);
          res.choices[0].message.content = JSON.stringify(validated);
        } catch (parseError) {
          console.log(JSON.stringify(res.choices, null, 2));
          console.warn(
            "Failed to parse/validate structured response from OpenAI:",
            parseError
          );
          // Fall back to returning the raw response
        }
      }
    } else {
      // Regular completion
      completion = await openai.chat.completions.create({
        model: model ?? aiModel,
        messages: openaiMessages,
        tools: toolsSchema,
        temperature,
      });
    }
    // console.log(completion);

    const assistantMessage = completion.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error("No response from AI service");
    }

    // Convert back to domain model and return
    return fromOpenAIMessage(assistantMessage);
  } catch (error: unknown) {
    // Check if it's a rate limit error
    const errorObj = error as { status?: number; code?: string };
    if (errorObj?.status === 429 || errorObj?.code === "rate_limit_exceeded") {
      if (retryCount >= MAX_RETRIES) {
        console.error(
          `Rate limit exceeded. Maximum retries (${MAX_RETRIES}) reached.`
        );
        throw new Error(`Rate limit exceeded after ${MAX_RETRIES} retries`);
      }

      console.log(
        `Rate limit hit (429). Retry attempt ${
          retryCount + 1
        }/${MAX_RETRIES}. Waiting 1 second...`
      );

      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, ratelimtBackoff));

      // Recursive retry
      return getOpenAiCompletion({
        messages,
        tools,
        responseFormat,
        temperature,
        model,
        retryCount: retryCount + 1,
      });
    }

    // Re-throw other errors
    throw error;
  }
}
