import { zodFunction, zodResponseFormat } from "openai/helpers/zod.mjs";
import type z from "zod";
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

export async function getAiCompletion({
  messages,
  tools,
  responseFormat,
  temperature = 0.1,
  provider = "openai",
}: {
  messages: ConversationMessage[];
  tools?: AiTool[];
  responseFormat?: z.ZodTypeAny;
  temperature?: number;
  provider?: "openai" | "ollama";
}): Promise<ConversationMessage> {
  if (provider === "ollama") {
    return getOllamaCompletion({
      messages,
      temperature,
    });
  }

  return getOpenAiCompletion({
    messages,
    tools,
    responseFormat,
    temperature,
  });
}

export async function getOllamaCompletion({
  messages,
  temperature = 0.1,
}: {
  messages: ConversationMessage[];
  temperature?: number;
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

  try {
    const response = await ollama.chat({
      model: OLLAMA_MODEL ?? "gpt-oss:120b",
      messages: ollamaMessages,
      options: {
        temperature,
      },
    });

    return {
      role: "assistant",
      content: response.message.content,
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
}: {
  messages: ConversationMessage[];
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
        model: aiModel,
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
        model: aiModel,
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
