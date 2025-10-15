import { zodFunction, zodResponseFormat } from "openai/helpers/zod.mjs";
import type z from "zod";
import type { ConversationMessage } from "../../server/trpc/routers/rubricAI/rubricAiReportModels";
import {
  toOpenAIMessage,
  fromOpenAIMessage,
} from "../../server/trpc/routers/rubricAI/rubricAiUtils";
import type { AiTool } from "./createAiTool";
import { aiModel, getOpenaiClient } from "./getOpenaiClient";
import { enqueueJob, type QueueJob } from "./AiQueue";

const ratelimtBackoff = 1000 * 15;
const MAX_RETRIES = 10;
const DEFAULT_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE ?? "0.1");

export async function getAiCompletion({
  messages,
  tools,
  responseFormat,
  model,
  temperature,
}: {
  messages: ConversationMessage[];
  tools?: AiTool[];
  responseFormat?: z.ZodTypeAny;
  model?: string;
  temperature?: number;
}): Promise<ConversationMessage> {
  return new Promise<ConversationMessage>((resolve, reject) => {
    const jobId = `completion-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 11)}`;

    const job: QueueJob = {
      id: jobId,
      execute: () =>
        getOpenAiCompletion({
          messages,
          tools,
          responseFormat,
          model,
          temperature,
        }),
      resolve,
      reject,
    };

    enqueueJob(job);
  });
}

async function getOpenAiCompletion({
  messages,
  tools,
  responseFormat,
  model,
  temperature,
  retryCount = 0,
}: {
  messages: ConversationMessage[];
  tools?: AiTool[];
  responseFormat?: z.ZodTypeAny;
  temperature?: number;
  model?: string;
  retryCount?: number;
}): Promise<ConversationMessage> {
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
        temperature: temperature ?? DEFAULT_TEMPERATURE,
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
        temperature: temperature ?? DEFAULT_TEMPERATURE,
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
        temperature: DEFAULT_TEMPERATURE,
        model,
        retryCount: retryCount + 1,
      });
    }

    // Re-throw other errors
    throw error;
  }
}
